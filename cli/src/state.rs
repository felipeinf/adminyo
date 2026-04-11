use crate::config::schema::{AdminyoFile, Column, ColumnType, EnvsFile};
use crate::config::ResolvedEnvironment;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

pub const CONFIG_VERSION: &str = "1";

#[derive(Clone)]
pub struct AppState {
    pub inner: Arc<RwLock<InnerState>>,
    pub config_dir: PathBuf,
    pub admin_user: String,
    pub admin_pass: Vec<u8>,
    pub jwt_secret: Vec<u8>,
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
