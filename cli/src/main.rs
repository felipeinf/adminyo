mod config;
mod embedded;
mod server;
mod state;
mod watcher;

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use clap::{Parser, Subcommand};
use serde_json::Value;
use tokio::sync::RwLock;

use crate::config::{load_adminyo, load_envs, resolve_environment};
use crate::embedded::Asset;
use crate::server::routes::{build_config_response, BuildConfigError, ConfigBuildKind};
use crate::state::{AppState, InnerState};

#[derive(Parser)]
#[command(name = "nyo")]
#[command(about = "YAML-driven admin panel")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Init {
        #[arg(short, long)]
        force: bool,
        #[arg(long, default_value = ".")]
        dir: PathBuf,
    },
    New {
        name: String,
        #[arg(short, long)]
        force: bool,
    },
    Dev {
        #[arg(long, default_value = "dev")]
        env: String,
        #[arg(long, default_value_t = 4321)]
        port: u16,
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        #[arg(long, default_value = ".")]
        dir: PathBuf,
    },
    Build {
        #[arg(long, default_value = "production")]
        env: String,
        #[arg(long, default_value = ".")]
        dir: PathBuf,
        #[arg(long, default_value = "dist")]
        out: PathBuf,
    },
    Validate {
        #[arg(long, default_value = "dev")]
        env: String,
        #[arg(long, default_value = ".")]
        dir: PathBuf,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let cli = Cli::parse();
    match cli.command {
        Commands::Init { force, dir } => cmd_init(&dir, force),
        Commands::New { name, force } => cmd_new(&name, force),
        Commands::Dev {
            env,
            port,
            host,
            dir,
        } => cmd_dev(&dir, &env, &host, port).await,
        Commands::Build { env, dir, out } => cmd_build(&dir, &env, &out).await,
        Commands::Validate { env, dir } => cmd_validate(&dir, &env),
    }
}

fn scaffold_project(dir: &Path, force: bool) -> anyhow::Result<()> {
    std::fs::create_dir_all(dir)?;
    let files = [
        ("adminyo.yml", INIT_ADMINYO_YML),
        ("nyo.example.yml", NYO_EXAMPLE_YML),
        ("envs.yml", INIT_ENVS_YML),
        (".env.example", INIT_ENV_EXAMPLE),
    ];
    for (name, _content) in files {
        let p = dir.join(name);
        if p.exists() && !force {
            anyhow::bail!("{} already exists (use --force to overwrite)", p.display());
        }
    }
    std::fs::write(dir.join("adminyo.yml"), INIT_ADMINYO_YML)?;
    std::fs::write(dir.join("nyo.example.yml"), NYO_EXAMPLE_YML)?;
    std::fs::write(dir.join("envs.yml"), INIT_ENVS_YML)?;
    std::fs::write(dir.join(".env.example"), INIT_ENV_EXAMPLE)?;
    let assets = dir.join("assets");
    std::fs::create_dir_all(&assets)?;
    let gitkeep = assets.join(".gitkeep");
    if !gitkeep.exists() {
        std::fs::write(gitkeep, "")?;
    }
    Ok(())
}

fn cmd_init(dir: &Path, force: bool) -> anyhow::Result<()> {
    scaffold_project(dir, force)?;
    println!(
        "Created adminyo.yml, nyo.example.yml, envs.yml, .env.example, and assets/ in {}",
        dir.display()
    );
    println!("Next: cp .env.example .env && edit credentials, then run: nyo dev");
    Ok(())
}

fn cmd_new(name: &str, force: bool) -> anyhow::Result<()> {
    let dir = PathBuf::from(name);
    if dir.exists() {
        if !dir.is_dir() {
            anyhow::bail!("{} exists and is not a directory", dir.display());
        }
        if !force {
            anyhow::bail!(
                "{} already exists (use --force to overwrite project files)",
                dir.display()
            );
        }
    } else {
        std::fs::create_dir_all(&dir)?;
    }
    scaffold_project(&dir, force)?;
    println!(
        "Created adminyo.yml, nyo.example.yml, envs.yml, .env.example, and assets/ in {}",
        dir.display()
    );
    println!(
        "Next: cd {} && cp .env.example .env && edit credentials, then run: nyo dev --dir .",
        dir.display()
    );
    Ok(())
}

fn load_dotenv_from_project(dir: &Path) {
    let env_file = dir.join(".env");
    if env_file.is_file() {
        let _ = dotenvy::from_path(&env_file);
    } else {
        let _ = dotenvy::dotenv();
    }
}

fn cmd_validate(dir: &Path, env_name: &str) -> anyhow::Result<()> {
    load_dotenv_from_project(dir);
    let adminyo_path = dir.join("adminyo.yml");
    let envs_path = dir.join("envs.yml");
    let adminyo = load_adminyo(&adminyo_path).map_err(|e| {
        eprintln!("adminyo.yml: {e}");
        e
    })?;
    let envs = load_envs(&envs_path).map_err(|e| {
        eprintln!("envs.yml: {e}");
        e
    })?;
    let raw = envs
        .environments
        .get(env_name)
        .ok_or_else(|| anyhow::anyhow!("environment {env_name} not defined in envs.yml"))?;
    resolve_environment(raw).map_err(|e| {
        eprintln!("resolve environment: {e}");
        e
    })?;
    let _ = adminyo;
    println!("OK");
    Ok(())
}

async fn cmd_dev(dir: &Path, env_name: &str, host: &str, port: u16) -> anyhow::Result<()> {
    load_dotenv_from_project(dir);
    let jwt_secret = std::env::var("ADMINYO_SECRET").context("ADMINYO_SECRET must be set")?;
    if jwt_secret.is_empty() {
        anyhow::bail!("ADMINYO_SECRET must be non-empty");
    }

    let config_dir = dir.canonicalize().unwrap_or_else(|_| dir.to_path_buf());
    let adminyo_path = config_dir.join("adminyo.yml");
    let envs_path = config_dir.join("envs.yml");
    let adminyo = load_adminyo(&adminyo_path)?;
    let envs = load_envs(&envs_path)?;
    let raw = envs
        .environments
        .get(env_name)
        .ok_or_else(|| anyhow::anyhow!("environment {env_name} not defined"))?;
    let resolved = resolve_environment(raw)?;

    let (admin_user, admin_pass) = if adminyo.auth.is_some() {
        (
            std::env::var("ADMINYO_USER").unwrap_or_default(),
            std::env::var("ADMINYO_PASS")
                .unwrap_or_default()
                .into_bytes(),
        )
    } else {
        let admin_user = std::env::var("ADMINYO_USER").context("ADMINYO_USER must be set")?;
        let admin_pass = std::env::var("ADMINYO_PASS").context("ADMINYO_PASS must be set")?;
        if admin_user.is_empty() || admin_pass.is_empty() {
            anyhow::bail!("ADMINYO_USER and ADMINYO_PASS must be non-empty when adminyo.yml has no auth block");
        }
        (admin_user, admin_pass.into_bytes())
    };

    let inner = InnerState::new(adminyo, envs, env_name.to_string(), resolved);
    let (ws_tx, _) = tokio::sync::broadcast::channel(32);
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;

    let state = Arc::new(AppState {
        inner: Arc::new(RwLock::new(inner)),
        config_dir: config_dir.clone(),
        admin_user,
        admin_pass,
        jwt_secret: jwt_secret.into_bytes(),
        session_tokens: Arc::new(RwLock::new(std::collections::HashMap::new())),
        ws_tx,
        http,
    });

    let handle = tokio::runtime::Handle::current();
    let _keep_watcher = watcher::spawn_config_watcher(
        config_dir.clone(),
        env_name.to_string(),
        state.clone(),
        handle,
    )?;

    let app = server::app(state.clone());
    let addr: SocketAddr = format!("{host}:{port}")
        .parse()
        .with_context(|| format!("invalid host/port: {host}:{port}"))?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Nyo listening on http://{host}:{port}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    tracing::info!("shutdown signal received");
}

async fn cmd_build(dir: &Path, env_name: &str, out: &Path) -> anyhow::Result<()> {
    load_dotenv_from_project(dir);
    let config_dir = dir.canonicalize().unwrap_or_else(|_| dir.to_path_buf());
    let adminyo_path = config_dir.join("adminyo.yml");
    let envs_path = config_dir.join("envs.yml");
    let adminyo = load_adminyo(&adminyo_path)?;
    let envs = load_envs(&envs_path)?;
    let raw = envs
        .environments
        .get(env_name)
        .ok_or_else(|| anyhow::anyhow!("environment {env_name} not defined in envs.yml"))?;
    let resolved = resolve_environment(raw)?;

    if adminyo.auth.is_none() {
        tracing::warn!(
            "adminyo.yml has no auth block; static login will not work until you add auth.loginEndpoint"
        );
    }

    let inner = InnerState::new(
        adminyo.clone(),
        envs,
        env_name.to_string(),
        resolved.clone(),
    );
    let (ws_tx, _) = tokio::sync::broadcast::channel(2);
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()?;
    let state = Arc::new(AppState {
        inner: Arc::new(RwLock::new(inner)),
        config_dir: config_dir.clone(),
        admin_user: String::new(),
        admin_pass: Vec::new(),
        jwt_secret: b"nyo-build-placeholder-not-for-jwt01".to_vec(),
        session_tokens: Arc::new(RwLock::new(std::collections::HashMap::new())),
        ws_tx,
        http,
    });

    let mut config_json = build_config_response(&state, ConfigBuildKind::StaticBundle, None)
        .await
        .map_err(|e| match e {
            BuildConfigError::Inference(m) => anyhow::anyhow!("{m}"),
            BuildConfigError::Internal(err) => err,
        })?;

    if let Value::Object(ref mut map) = config_json {
        map.insert(
            "baseUrl".to_string(),
            Value::String(resolved.base_url.trim_end_matches('/').to_string()),
        );
        map.insert("mode".to_string(), Value::String("static".into()));
        if let Some(auth) = &adminyo.auth {
            map.insert("auth".to_string(), serde_json::to_value(auth)?);
        }
        if let Some(Value::Object(bm)) = map.get_mut("branding") {
            bm.remove("logoUrl");
        }
    }

    std::fs::create_dir_all(out)?;
    let config_path = out.join("config.json");
    std::fs::write(&config_path, serde_json::to_string_pretty(&config_json)?)?;

    for path in Asset::iter() {
        let path_str = path.as_ref();
        let Some(file) = Asset::get(path_str) else {
            continue;
        };
        let dest = out.join(path_str);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if path_str == "index.html" {
            let html = std::str::from_utf8(file.data.as_ref())
                .context("embedded index.html is not UTF-8")?
                .to_string();
            let injected = inject_static_config_script(html);
            std::fs::write(dest, injected)?;
        } else {
            std::fs::write(dest, file.data.as_ref())?;
        }
    }

    println!("Built static panel into {}", out.display());
    Ok(())
}

fn inject_static_config_script(html: String) -> String {
    let tag = "<script>window.__NYO_CONFIG_URL__=\"./config.json\"</script>";
    if let Some(pos) = html.find("</head>") {
        let mut s = String::with_capacity(html.len() + tag.len());
        s.push_str(&html[..pos]);
        s.push_str(tag);
        s.push_str(&html[pos..]);
        s
    } else if let Some(pos) = html.find("<script") {
        let mut s = String::with_capacity(html.len() + tag.len());
        s.push_str(&html[..pos]);
        s.push_str(tag);
        s.push_str(&html[pos..]);
        s
    } else {
        format!("{html}{tag}")
    }
}

const INIT_ADMINYO_YML: &str = r##"branding:
  name: "My Admin"
  logo: "./assets/logo.png"
  primaryColor: "#6C5CE7"

entities:
  - name: Users
    endpoint: /api/users
    idField: id
    actions:
      - list
      - detail
      - create
      - edit
      - delete
    columns:
      - field: name
        label: Name
        searchable: true
      - field: email
        label: Email
        searchable: true

  - name: Items
    endpoint: /api/items
    idField: id
    actions:
      - list
      - detail

# Optional: copy the `auth` block from nyo.example.yml to validate panel login against your API (baseUrl + loginEndpoint).
"##;

const NYO_EXAMPLE_YML: &str = r##"branding:
  name: "My Admin"
  logo: "./assets/logo.png"
  primaryColor: "#6C5CE7"

auth:
  loginEndpoint: /api/auth/login
  usernameField: email
  passwordField: password

entities:
  - name: Users
    endpoint: /api/users
    idField: id
    actions:
      - list
      - detail
    columns:
      - field: name
        label: Name
        searchable: true
"##;

const INIT_ENVS_YML: &str = r#"environments:
  dev:
    baseUrl: http://localhost:3000
    headers:
      Authorization: "Bearer ${DEV_TOKEN}"
  production:
    baseUrl: https://api.example.com
    headers: {}
"#;

const INIT_ENV_EXAMPLE: &str = r#"ADMINYO_USER=admin
ADMINYO_PASS=change-me
ADMINYO_SECRET=change-this-jwt-secret

DEV_TOKEN=your-api-token
"#;
