pub mod auth;
pub mod proxy;
pub mod routes;
pub mod ws;

use std::sync::Arc;

use axum::{middleware::from_fn_with_state, routing::get, routing::post, Router};

use crate::state::AppState;

pub fn app(state: Arc<AppState>) -> Router {
    let st = state.clone();
    let auth_layer = from_fn_with_state(st.clone(), auth::auth_middleware);
    let protected = Router::new()
        .route("/adminyo-config", get(routes::adminyo_config))
        .route(
            "/adminyo-proxy/*rest",
            axum::routing::any(proxy::proxy_request),
        )
        .route("/ws", get(ws::ws_reload))
        .layer(auth_layer);
    Router::new()
        .route("/health", get(routes::health))
        .route("/auth/me", get(routes::auth_me))
        .route("/auth/login", post(routes::login))
        .route("/auth/logout", post(routes::logout))
        .route("/adminyo-public-config", get(routes::public_config))
        .route("/adminyo-assets/logo", get(routes::logo_asset))
        .merge(protected)
        .fallback(get(routes::static_handler))
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(tower_http::compression::CompressionLayer::new())
        .with_state(state)
}
