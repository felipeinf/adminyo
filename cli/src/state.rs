use crate::config::schema::{AdminyoFile, AuthConfig, Column, ColumnType, EnvsFile};
use crate::config::ResolvedEnvironment;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

pub const CONFIG_VERSION: &str = "1";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SessionToken {
    pub scheme: String,
    pub value: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResolvedUpstreamToken {
    pub token: SessionToken,
    pub detected_path: Option<String>,
}

#[derive(Clone)]
pub struct AppState {
    pub inner: Arc<RwLock<InnerState>>,
    pub config_dir: PathBuf,
    pub admin_user: String,
    pub admin_pass: Vec<u8>,
    pub jwt_secret: Vec<u8>,
    /// Maps JWT `sub` (login identifier) to upstream Authorization credentials when using `auth` in adminyo.yml.
    pub session_tokens: Arc<RwLock<HashMap<String, SessionToken>>>,
    pub ws_tx: tokio::sync::broadcast::Sender<String>,
    pub http: reqwest::Client,
}

pub struct InnerState {
    pub adminyo: AdminyoFile,
    pub envs: EnvsFile,
    pub active_env: String,
    pub resolved: ResolvedEnvironment,
    pub schema_cache: HashMap<SchemaCacheKey, Vec<Column>>,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct SchemaCacheKey {
    pub entity_name: String,
    pub endpoint: String,
    pub env: String,
    pub data_path: Option<String>,
    pub row_path: Option<String>,
}

impl InnerState {
    pub fn new(
        adminyo: AdminyoFile,
        envs: EnvsFile,
        active_env: String,
        resolved: ResolvedEnvironment,
    ) -> Self {
        Self {
            adminyo,
            envs,
            active_env,
            resolved,
            schema_cache: HashMap::new(),
        }
    }

    pub fn invalidate_schema_cache(&mut self) {
        self.schema_cache.clear();
    }

    pub fn cache_key(&self, entity: &crate::config::schema::Entity) -> SchemaCacheKey {
        SchemaCacheKey {
            entity_name: entity.name.clone(),
            endpoint: entity.endpoint.clone(),
            env: self.active_env.clone(),
            data_path: entity.data_path.clone(),
            row_path: entity.row_path.clone(),
        }
    }
}

pub fn infer_columns_from_row(row: &serde_json::Map<String, Value>) -> Vec<Column> {
    let mut keys: Vec<_> = row.keys().cloned().collect();
    keys.sort();
    keys.into_iter()
        .map(|field| {
            let v = row.get(&field).cloned().unwrap_or(Value::Null);
            let r#type = infer_type(&v);
            Column {
                field: field.clone(),
                label: Some(field),
                searchable: matches!(r#type, ColumnType::Text | ColumnType::Date),
                r#type: Some(r#type),
                r#enum: None,
            }
        })
        .collect()
}

fn infer_type(v: &Value) -> ColumnType {
    match v {
        Value::Null => ColumnType::Text,
        Value::Bool(_) => ColumnType::Boolean,
        Value::Number(n) => {
            if n.is_i64() || n.is_u64() || n.is_f64() {
                ColumnType::Number
            } else {
                ColumnType::Text
            }
        }
        Value::String(s) => {
            if looks_like_iso_date(s) {
                ColumnType::Date
            } else {
                ColumnType::Text
            }
        }
        Value::Array(_) => ColumnType::Array,
        Value::Object(_) => ColumnType::Object,
    }
}

fn looks_like_iso_date(s: &str) -> bool {
    let re = regex::Regex::new(r"^\d{4}-\d{2}-\d{2}").unwrap();
    re.is_match(s)
}

fn path_segment_logical(seg: &str) -> &str {
    let t = seg.trim();
    if t.eq_ignore_ascii_case("indentity") {
        "identity"
    } else {
        t
    }
}

fn object_get_ci<'a>(
    map: &'a serde_json::Map<String, Value>,
    seg: &str,
) -> Option<&'a Value> {
    let t = seg.trim();
    let logical = path_segment_logical(seg);
    if let Some(v) = map.get(t) {
        return Some(v);
    }
    if logical != t {
        if let Some(v) = map.get(logical) {
            return Some(v);
        }
    }
    let target = logical.to_ascii_lowercase();
    map.iter()
        .find(|(k, _)| k.to_ascii_lowercase() == target)
        .map(|(_, v)| v)
}

pub fn navigate_json_path_value<'a>(root: &'a Value, path: &'_ str) -> Option<&'a Value> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Some(root);
    }
    let segments: Vec<&str> = trimmed
        .trim_matches('.')
        .split('.')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    if segments.is_empty() {
        return Some(root);
    }
    let mut cur = root;
    for seg in segments {
        cur = object_get_ci(cur.as_object()?, seg)?;
    }
    Some(cur)
}

const AUTH_TOKEN_WRAPPERS: &[&str] = &["", "data", "result", "auth", "payload"];

const AUTH_TOKEN_KEY_GROUPS: &[&[&str]] = &[
    &["access_token", "accessToken"],
    &["token"],
    &["jwt"],
    &["id_token", "idToken"],
];

pub fn resolve_upstream_session_token(
    root: &Value,
    auth_cfg: &AuthConfig,
) -> Result<ResolvedUpstreamToken, String> {
    if let Some(ref path) = auth_cfg.token_path {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            return resolve_upstream_session_token_auto(root, auth_cfg);
        }
        if let Some(token_val) = navigate_json_path_value(root, trimmed) {
            let raw = token_val
                .as_str()
                .filter(|s| !s.is_empty())
                .ok_or_else(|| {
                    format!(r#"token at "{trimmed}" is not a non-empty string"#)
                })?;
            let container = parent_object_for_json_path(root, trimmed);
            let token = resolve_scheme_and_value(raw, container, root, auth_cfg)?;
            Ok(ResolvedUpstreamToken {
                token,
                detected_path: Some(trimmed.to_string()),
            })
        } else if trimmed == "token" {
            resolve_upstream_session_token_auto(root, auth_cfg)
        } else {
            Err(format!(r#"token not found at path "{trimmed}""#))
        }
    } else {
        resolve_upstream_session_token_auto(root, auth_cfg)
    }
}

fn parent_object_for_json_path<'a>(
    root: &'a Value,
    path: &str,
) -> Option<&'a serde_json::Map<String, Value>> {
    let trimmed = path.trim().trim_matches('.');
    if trimmed.is_empty() {
        return root.as_object();
    }
    let segments: Vec<&str> = trimmed
        .split('.')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    if segments.len() <= 1 {
        return root.as_object();
    }
    let parent_path = segments[..segments.len() - 1].join(".");
    navigate_json_path_value(root, &parent_path).and_then(|v| v.as_object())
}

fn resolve_upstream_session_token_auto(
    root: &Value,
    auth_cfg: &AuthConfig,
) -> Result<ResolvedUpstreamToken, String> {
    for wrapper in AUTH_TOKEN_WRAPPERS {
        let obj_opt: Option<&serde_json::Map<String, Value>> = if wrapper.is_empty() {
            root.as_object()
        } else {
            navigate_json_path_value(root, wrapper).and_then(|v| v.as_object())
        };
        let Some(obj) = obj_opt else {
            continue;
        };
        for key_group in AUTH_TOKEN_KEY_GROUPS {
            for &key_used in key_group.iter() {
                if let Some(v) = object_get_ci(obj, key_used) {
                    if let Some(raw) = v.as_str().filter(|s| !s.is_empty()) {
                        let path = if wrapper.is_empty() {
                            key_used.to_string()
                        } else {
                            format!("{wrapper}.{key_used}")
                        };
                        let token = resolve_scheme_and_value(raw, Some(obj), root, auth_cfg)?;
                        return Ok(ResolvedUpstreamToken {
                            token,
                            detected_path: Some(path),
                        });
                    }
                }
            }
        }
    }
    Err(
        "could not locate token in auth response (expected one of: access_token, accessToken, token, jwt, id_token, idToken; optionally inside data/result/auth/payload). Define auth.tokenPath to override."
            .into(),
    )
}

fn token_type_from_map(map: &serde_json::Map<String, Value>) -> Option<String> {
    object_get_ci(map, "token_type")
        .or_else(|| object_get_ci(map, "tokenType"))
        .and_then(|v| v.as_str().map(|s| s.to_string()))
}

fn normalize_scheme(s: &str) -> String {
    let t = s.trim();
    if t.is_empty() {
        return String::new();
    }
    match t.to_ascii_lowercase().as_str() {
        "bearer" => "Bearer".to_string(),
        "token" => "Token".to_string(),
        "basic" => "Basic".to_string(),
        _ => {
            let mut c = t.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        }
    }
}

fn strip_scheme_prefix_if_present(raw: &str, scheme: &str) -> String {
    let prefix = format!("{} ", scheme);
    if raw.len() >= prefix.len() && raw[..prefix.len()].eq_ignore_ascii_case(&prefix) {
        raw[prefix.len()..].to_string()
    } else {
        raw.to_string()
    }
}

fn split_prefixed_raw_token(raw: &str) -> Option<(String, String)> {
    let t = raw.trim();
    let pos = t.find(|c: char| c.is_whitespace())?;
    let scheme_raw = t[..pos].trim();
    let rest = t[pos + 1..].trim_start();
    if scheme_raw.is_empty() || rest.is_empty() {
        return None;
    }
    if !scheme_raw
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return None;
    }
    Some((normalize_scheme(scheme_raw), rest.to_string()))
}

fn resolve_scheme_and_value(
    raw: &str,
    container: Option<&serde_json::Map<String, Value>>,
    root: &Value,
    auth_cfg: &AuthConfig,
) -> Result<SessionToken, String> {
    if let Some(obj) = container {
        if let Some(tt) = token_type_from_map(obj) {
            let scheme = normalize_scheme(&tt);
            if scheme.is_empty() {
                return Err("token_type is empty".into());
            }
            let value = strip_scheme_prefix_if_present(raw, &scheme);
            return Ok(SessionToken { scheme, value });
        }
    }
    if let Some(obj) = root.as_object() {
        if let Some(tt) = token_type_from_map(obj) {
            let scheme = normalize_scheme(&tt);
            if scheme.is_empty() {
                return Err("token_type is empty".into());
            }
            let value = strip_scheme_prefix_if_present(raw, &scheme);
            return Ok(SessionToken { scheme, value });
        }
    }
    if let Some((scheme, value)) = split_prefixed_raw_token(raw) {
        return Ok(SessionToken { scheme, value });
    }
    if let Some(ref s) = auth_cfg.token_scheme {
        let scheme = normalize_scheme(s.trim());
        if scheme.is_empty() {
            return Err("auth.tokenScheme is empty".into());
        }
        let value = strip_scheme_prefix_if_present(raw, &scheme);
        return Ok(SessionToken { scheme, value });
    }
    Ok(SessionToken {
        scheme: "Bearer".into(),
        value: raw.to_string(),
    })
}

fn extract_first_object_array_from_value(v: &Value) -> Option<&serde_json::Map<String, Value>> {
    match v {
        Value::Array(arr) => arr.first().and_then(|x| x.as_object()),
        Value::Object(map) => {
            for val in map.values() {
                if let Value::Array(arr) = val {
                    if let Some(Value::Object(obj)) = arr.first() {
                        return Some(obj);
                    }
                }
            }
            None
        }
        _ => None,
    }
}

pub fn extract_first_object_array<'a>(
    root: &'a Value,
    data_path: Option<&str>,
) -> Option<&'a serde_json::Map<String, Value>> {
    let target = match data_path {
        None => root,
        Some(p) if p.trim().is_empty() => root,
        Some(p) => navigate_json_path_value(root, p)?,
    };
    extract_first_object_array_from_value(target)
}

#[cfg(test)]
mod session_token_tests {
    use super::*;
    use crate::config::schema::AuthConfig;
    use serde_json::json;

    fn auth_auto() -> AuthConfig {
        AuthConfig {
            login_endpoint: "/login".into(),
            token_path: None,
            token_scheme: None,
            username_field: "email".into(),
            password_field: "password".into(),
        }
    }

    #[test]
    fn auto_detect_access_token_root() {
        let root = json!({"access_token":"tok","token_type":"bearer"});
        let r = resolve_upstream_session_token(&root, &auth_auto()).unwrap();
        assert_eq!(r.token.scheme, "Bearer");
        assert_eq!(r.token.value, "tok");
        assert_eq!(r.detected_path.as_deref(), Some("access_token"));
    }

    #[test]
    fn auto_detect_nested_data_token() {
        let root = json!({"data":{"token":"nested"}});
        let r = resolve_upstream_session_token(&root, &auth_auto()).unwrap();
        assert_eq!(r.token.value, "nested");
        assert_eq!(r.detected_path.as_deref(), Some("data.token"));
    }

    #[test]
    fn manual_token_path_nested() {
        let cfg = AuthConfig {
            login_endpoint: "/login".into(),
            token_path: Some("credentials.jwt".into()),
            token_scheme: None,
            username_field: "email".into(),
            password_field: "password".into(),
        };
        let root = json!({"credentials":{"jwt":"manual"}});
        let r = resolve_upstream_session_token(&root, &cfg).unwrap();
        assert_eq!(r.token.value, "manual");
        assert_eq!(r.token.scheme, "Bearer");
    }

    #[test]
    fn prefixed_raw_token_yields_scheme() {
        let root = json!({"token":"Bearer xyz"});
        let r = resolve_upstream_session_token(&root, &auth_auto()).unwrap();
        assert_eq!(r.token.scheme, "Bearer");
        assert_eq!(r.token.value, "xyz");
    }

    #[test]
    fn auto_detect_fails_with_clear_message() {
        let root = json!({"foo":"bar"});
        let err = resolve_upstream_session_token(&root, &auth_auto()).unwrap_err();
        assert!(err.contains("could not locate token"));
        assert!(err.contains("tokenPath"));
    }

    #[test]
    fn legacy_token_path_token_falls_back_to_auto_when_missing() {
        let cfg = AuthConfig {
            login_endpoint: "/login".into(),
            token_path: Some("token".into()),
            token_scheme: None,
            username_field: "email".into(),
            password_field: "password".into(),
        };
        let root = json!({"access_token":"from-oauth","token_type":"Bearer"});
        let r = resolve_upstream_session_token(&root, &cfg).unwrap();
        assert_eq!(r.token.value, "from-oauth");
        assert_eq!(r.detected_path.as_deref(), Some("access_token"));
    }
}
