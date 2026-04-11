use axum::{
    extract::{Extension, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::config::canonicalize_logo_path;
use crate::config::contrast_foreground_hsl;
use crate::config::schema::{Column, Entity};
use crate::config::{assign_entity_slugs, load_adminyo, load_envs, resolve_environment};
use crate::embedded::Asset;
use crate::server::auth::{
    clear_auth_cookie, create_token, ct_eq_str, parse_and_verify, set_auth_cookie,
    token_from_cookie, unauthorized_response, verify_password, AuthUser, LoginBody,
};
use crate::state::SchemaCacheKey;
use crate::state::{
    extract_first_object_array, infer_columns_from_row, AppState, InnerState, CONFIG_VERSION,
};

pub(crate) enum BuildConfigError {
    Inference(String),
    Internal(anyhow::Error),
}

#[derive(Clone, Copy)]
pub(crate) enum ConfigBuildKind {
    Server,
    StaticBundle,
}

pub async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

pub async fn auth_me(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let Some(token) = token_from_cookie(&headers) else {
        return unauthorized_response();
    };
    let Ok(claims) = parse_and_verify(&state.jwt_secret, token) else {
        return unauthorized_response();
    };
    (StatusCode::OK, Json(json!({ "ok": true, "user": claims.sub }))).into_response()
}

pub async fn logout() -> impl IntoResponse {
    let cookie = clear_auth_cookie();
    (
        StatusCode::OK,
        [(header::SET_COOKIE, cookie)],
        Json(json!({ "ok": true })),
    )
        .into_response()
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(body): Json<LoginBody>,
) -> impl IntoResponse {
    if !ct_eq_str(&state.admin_user, &body.user) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid credentials"})),
        )
            .into_response();
    }
    if !verify_password(&state.admin_pass, &body.pass) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error":"invalid credentials"})),
        )
            .into_response();
    }
    let token = match create_token(&state.jwt_secret, &body.user) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!(error = %e, "JWT encode failed on login");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("{e}")})),
            )
                .into_response();
        }
    };
    let cookie = set_auth_cookie(&token);
    (
        StatusCode::OK,
        [(header::SET_COOKIE, cookie)],
        Json(json!({"ok": true})),
    )
        .into_response()
}

pub async fn public_config(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let inner = state.inner.read().await;
    let logo_url = branding_logo_url(&state, &inner);
    let b = &inner.adminyo.branding;
    let primary_foreground = b
        .primary_color
        .as_deref()
        .and_then(contrast_foreground_hsl);
    Json(json!({
        "version": CONFIG_VERSION,
        "branding": {
            "name": b.name,
            "primaryColor": b.primary_color,
            "primaryForeground": primary_foreground,
            "theme": b.theme,
            "logoUrl": logo_url,
        }
    }))
}

fn branding_logo_url(state: &AppState, inner: &InnerState) -> Option<String> {
    inner.adminyo.branding.logo.as_ref().and_then(|p| {
        canonicalize_logo_path(&state.config_dir, p)
            .ok()
            .map(|_| "/adminyo-assets/logo".to_string())
    })
}

pub async fn adminyo_config(
    State(state): State<Arc<AppState>>,
    Extension(_auth): Extension<AuthUser>,
) -> impl IntoResponse {
    match build_config_response(&state, ConfigBuildKind::Server).await {
        Ok(v) => Json(v).into_response(),
        Err(BuildConfigError::Inference(msg)) => {
            tracing::error!(error = %msg, "adminyo-config schema inference failed");
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": msg, "source": "adminyo"})),
            )
                .into_response()
        }
        Err(BuildConfigError::Internal(e)) => {
            tracing::error!(error = %e, "adminyo-config failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string(), "source": "adminyo"})),
            )
                .into_response()
        }
    }
}

pub(crate) async fn build_config_response(
    state: &AppState,
    kind: ConfigBuildKind,
) -> Result<Value, BuildConfigError> {
    let (branding, active_env, slugs, entities) = {
        let inner = state.inner.read().await;
        (
            inner.adminyo.branding.clone(),
            inner.active_env.clone(),
            assign_entity_slugs(&inner.adminyo.entities),
            inner.adminyo.entities.clone(),
        )
    };
    let logo_url = branding.logo.as_ref().and_then(|p| {
        canonicalize_logo_path(&state.config_dir, p)
            .ok()
            .map(|_| "/adminyo-assets/logo".to_string())
    });
    let primary_foreground = branding
        .primary_color
        .as_deref()
        .and_then(contrast_foreground_hsl);
    let mut entities_out = Vec::new();
    for (i, e) in entities.iter().enumerate() {
        let cols = infer_entity_columns(state, e, kind).await?;
        entities_out.push(json!({
            "name": e.name,
            "slug": slugs[i],
            "endpoint": e.endpoint,
            "idField": e.id_field,
            "dataPath": e.data_path,
            "rowPath": e.row_path,
            "actions": e.actions,
            "columns": cols,
            "pagination": e.pagination,
        }));
    }
    Ok(json!({
        "version": CONFIG_VERSION,
        "environment": active_env,
        "branding": {
            "name": branding.name,
            "primaryColor": branding.primary_color,
            "primaryForeground": primary_foreground,
            "theme": branding.theme,
            "logoUrl": logo_url,
        },
        "entities": entities_out,
    }))
}

async fn infer_entity_columns(
    state: &AppState,
    entity: &Entity,
    kind: ConfigBuildKind,
) -> Result<Vec<Column>, BuildConfigError> {
    if let Some(cols) = &entity.columns {
        return Ok(cols.clone());
    }
    let key = {
        let inner = state.inner.read().await;
        inner.cache_key(entity)
    };
    {
        let inner = state.inner.read().await;
        if let Some(c) = inner.schema_cache.get(&key) {
            return Ok(c.clone());
        }
    }
    if matches!(kind, ConfigBuildKind::StaticBundle) {
        tracing::warn!(
            entity = %entity.name,
            "no columns in YAML; static build skips live API inference — add columns under this entity in adminyo.yml"
        );
        return Ok(Vec::new());
    }
    let (base, headers) = {
        let inner = state.inner.read().await;
        (
            inner.resolved.base_url.clone(),
            inner.resolved.headers.clone(),
        )
    };
    let path = entity.endpoint.trim_start_matches('/');
    let url = crate::server::proxy::join_url_for_test(&base, path, "").map_err(|m| {
        BuildConfigError::Internal(anyhow::anyhow!("invalid upstream URL: {m}"))
    })?;
    let mut req = state.http.get(&url);
    for (k, v) in &headers {
        req = req.header(k.as_str(), v.as_str());
    }
    let resp = req.send().await.map_err(|e| {
        BuildConfigError::Inference(format!(
            "Schema inference for \"{}\" failed: could not reach API ({})",
            entity.name, e
        ))
    })?;
    if !resp.status().is_success() {
        return Err(BuildConfigError::Inference(format!(
            "Schema inference for \"{}\" failed: GET {} returned {}",
            entity.name,
            url,
            resp.status()
        )));
    }
    let root: Value = resp.json().await.map_err(|_e| {
        BuildConfigError::Inference(format!(
            "Schema inference for \"{}\" failed: invalid JSON from {}",
            entity.name, url
        ))
    })?;
    let row = extract_first_object_array(&root, entity.data_path.as_deref()).ok_or_else(|| {
        BuildConfigError::Inference(format!(
            "Schema inference for \"{}\" failed: no object list in response from {}",
            entity.name, url
        ))
    })?;
    let row_value = Value::Object(row.clone());
    let cols = match entity
        .row_path
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        None => infer_columns_from_row(row),
        Some(p) => {
            match crate::state::navigate_json_path_value(&row_value, p).and_then(|v| v.as_object()) {
                Some(sample) => infer_columns_from_row(sample),
                None => {
                    tracing::warn!(
                        entity = %entity.name,
                        row_path = %p,
                        "rowPath not found or not an object on first list item; inferred columns empty"
                    );
                    Vec::new()
                }
            }
        }
    };
    let env_name = {
        let inner = state.inner.read().await;
        inner.active_env.clone()
    };
    let mut w = state.inner.write().await;
    w.schema_cache.insert(
        SchemaCacheKey {
            entity_name: entity.name.clone(),
            endpoint: entity.endpoint.clone(),
            env: env_name,
            data_path: entity.data_path.clone(),
            row_path: entity.row_path.clone(),
        },
        cols.clone(),
    );
    Ok(cols)
}

pub async fn logo_asset(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let rel = {
        let inner = state.inner.read().await;
        inner.adminyo.branding.logo.clone()
    };
    let Some(rel) = rel else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let path = match canonicalize_logo_path(&state.config_dir, &rel) {
        Ok(p) => p,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    match tokio::fs::read(&path).await {
        Ok(bytes) => {
            let ct = if path.extension().and_then(|s| s.to_str()) == Some("png") {
                "image/png"
            } else if path.extension().and_then(|s| s.to_str()) == Some("svg") {
                "image/svg+xml"
            } else {
                "application/octet-stream"
            };
            ([(header::CONTENT_TYPE, ct)], bytes).into_response()
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

pub async fn static_handler(uri: axum::http::Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');
    let file = if path.is_empty() { "index.html" } else { path };
    match Asset::get(file) {
        Some(c) => {
            let ct = content_type(file);
            ([(header::CONTENT_TYPE, ct)], c.data).into_response()
        }
        None => match Asset::get("index.html") {
            Some(c) => ([(header::CONTENT_TYPE, "text/html")], c.data).into_response(),
            None => StatusCode::NOT_FOUND.into_response(),
        },
    }
}

fn content_type(path: &str) -> &'static str {
    if path.ends_with(".js") {
        "application/javascript"
    } else if path.ends_with(".css") {
        "text/css"
    } else if path.ends_with(".html") {
        "text/html"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".ico") {
        "image/x-icon"
    } else if path.ends_with(".json") {
        "application/json"
    } else {
        "application/octet-stream"
    }
}

pub async fn reload_config_async(state: &Arc<AppState>, active_env: &str) -> Result<(), String> {
    let adminyo_path = state.config_dir.join("adminyo.yml");
    let envs_path = state.config_dir.join("envs.yml");
    let adminyo = load_adminyo(&adminyo_path).map_err(|e| e.to_string())?;
    let envs = load_envs(&envs_path).map_err(|e| e.to_string())?;
    let raw = envs
        .environments
        .get(active_env)
        .ok_or_else(|| format!("environment {active_env} not found"))?;
    let resolved = resolve_environment(raw).map_err(|e| e.to_string())?;
    let mut w = state.inner.write().await;
    w.adminyo = adminyo;
    w.envs = envs;
    w.active_env = active_env.to_string();
    w.resolved = resolved;
    w.invalidate_schema_cache();
    Ok(())
}
