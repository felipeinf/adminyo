use axum::{
    body::Body,
    extract::State,
    http::{header, HeaderMap, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use subtle::ConstantTimeEq;

use crate::state::AppState;

pub const COOKIE_NAME: &str = "adminyo_token";

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct AuthUser(pub String);

#[derive(Deserialize)]
pub struct LoginBody {
    #[serde(alias = "username")]
    pub user: String,
    #[serde(alias = "password")]
    pub pass: String,
}

pub fn verify_password(expected: &[u8], got: &str) -> bool {
    let got = got.as_bytes();
    if expected.len() != got.len() {
        return false;
    }
    expected.ct_eq(got).into()
}

pub fn ct_eq_str(expected: &str, got: &str) -> bool {
    let e = expected.as_bytes();
    let g = got.as_bytes();
    if e.len() != g.len() {
        return false;
    }
    e.ct_eq(g).into()
}

pub fn create_token(secret: &[u8], subject: &str) -> anyhow::Result<String> {
    let now = Utc::now();
    let exp = now + Duration::hours(24);
    let claims = Claims {
        sub: subject.to_string(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret),
    )
    .map_err(Into::into)
}

pub fn parse_and_verify(secret: &[u8], token: &str) -> anyhow::Result<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

pub fn token_from_cookie(headers: &HeaderMap) -> Option<&str> {
    let cookie = headers.get(header::COOKIE)?.to_str().ok()?;
    for part in cookie.split(';') {
        let part = part.trim();
        let Some((name, val)) = part.split_once('=') else {
            continue;
        };
        if name.trim() == COOKIE_NAME {
            return Some(val.trim());
        }
    }
    None
}

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    let token = match token_from_cookie(req.headers()) {
        Some(t) => t,
        None => return unauthorized_response(),
    };
    let claims = match parse_and_verify(&state.jwt_secret, token) {
        Ok(c) => c,
        Err(_) => return unauthorized_response(),
    };
    req.extensions_mut().insert(AuthUser(claims.sub));
    next.run(req).await
}

pub fn unauthorized_response() -> Response {
    let body = serde_json::json!({
        "error": "unauthorized",
        "source": "adminyo"
    });
    (StatusCode::UNAUTHORIZED, Json(body)).into_response()
}

pub fn set_auth_cookie(token: &str) -> String {
    format!("{COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400")
}

pub fn clear_auth_cookie() -> String {
    format!("{COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
}
