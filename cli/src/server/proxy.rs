use axum::{
    body::Body,
    extract::State,
    http::{HeaderName, HeaderValue, Request, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use reqwest::Url;
use std::sync::Arc;

use crate::state::AppState;

const HOP_HEADERS: &[&str] = &[
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
];

pub async fn proxy_request(State(state): State<Arc<AppState>>, req: Request<Body>) -> Response {
    let inner = state.inner.read().await;
    let base = inner.resolved.base_url.clone();
    let env_headers = inner.resolved.headers.clone();
    drop(inner);

    let uri = req.uri().clone();
    let path = uri.path();
    let rest = path
        .strip_prefix("/adminyo-proxy")
        .unwrap_or(path)
        .trim_start_matches('/');
    let query = uri.query().map(|q| format!("?{q}")).unwrap_or_default();

    let target = match join_url(&base, rest, &query) {
        Ok(u) => u,
        Err(e) => {
            return proxy_error(StatusCode::BAD_GATEWAY, format!("invalid target URL: {e}"));
        }
    };

    let method = req.method().clone();
    let headers = req.headers().clone();
    let body = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
        Ok(b) => b,
        Err(e) => {
            return proxy_error(StatusCode::BAD_REQUEST, format!("read body: {e}"));
        }
    };

    let mut rb = state.http.request(method.clone(), target);
    for (k, v) in &env_headers {
        if let (Ok(name), Ok(val)) = (
            HeaderName::try_from(k.as_str()),
            HeaderValue::try_from(v.as_str()),
        ) {
            rb = rb.header(name, val);
        }
    }

    let skip_client_auth = env_headers
        .keys()
        .any(|k| k.eq_ignore_ascii_case("authorization"));
    for (k, v) in headers.iter() {
        let name = k.as_str().to_lowercase();
        if HOP_HEADERS.contains(&name.as_str()) {
            continue;
        }
        if name == "cookie" || (name == "authorization" && skip_client_auth) {
            continue;
        }
        rb = rb.header(k, v);
    }

    let rb = if body.is_empty() {
        rb
    } else {
        rb.body(body.to_vec())
    };

    let resp = match rb.send().await {
        Ok(r) => r,
        Err(e) => {
            return proxy_error(
                StatusCode::BAD_GATEWAY,
                format!("upstream request failed: {e}"),
            );
        }
    };

    let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let mut res = Response::builder().status(status);
    for (k, v) in resp.headers().iter() {
        let name = k.as_str().to_lowercase();
        if matches!(
            name.as_str(),
            "connection" | "transfer-encoding" | "content-encoding"
        ) {
            continue;
        }
        if let Ok(val) = HeaderValue::try_from(v.as_bytes()) {
            res = res.header(k, val);
        }
    }
    match resp.bytes().await {
        Ok(b) => res.body(Body::from(b)).unwrap_or_else(|_| {
            proxy_error(StatusCode::BAD_GATEWAY, String::from("response body"))
        }),
        Err(e) => proxy_error(StatusCode::BAD_GATEWAY, format!("read upstream body: {e}")),
    }
}

fn join_url(base: &str, path: &str, query: &str) -> Result<Url, String> {
    let base = base.trim_end_matches('/');
    let path = path.trim_start_matches('/');
    let mut u = if path.is_empty() {
        Url::parse(base).map_err(|e| e.to_string())?
    } else {
        Url::parse(base)
            .map_err(|e| e.to_string())?
            .join(path)
            .map_err(|e| e.to_string())?
    };
    if !query.is_empty() {
        u.set_query(Some(query.trim_start_matches('?')));
    }
    Ok(u)
}

fn proxy_error(status: StatusCode, msg: impl Into<String>) -> Response {
    let body = serde_json::json!({
        "error": msg.into(),
        "source": "proxy"
    });
    (status, Json(body)).into_response()
}

pub fn join_url_for_test(base: &str, path: &str, query: &str) -> Result<String, String> {
    join_url(base, path, query)
        .map(|u| u.to_string())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_paths() {
        let u = join_url("http://localhost:3000", "api/users", "").unwrap();
        assert_eq!(u.as_str(), "http://localhost:3000/api/users");
        let u = join_url("http://localhost:3000/", "/api/users", "?a=1").unwrap();
        assert_eq!(u.as_str(), "http://localhost:3000/api/users?a=1");
    }
}
