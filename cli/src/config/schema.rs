use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminyoFile {
    pub branding: Branding,
    #[serde(default)]
    pub auth: Option<AuthConfig>,
    pub entities: Vec<Entity>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
}

fn default_theme() -> Theme {
    Theme::Light
}

fn default_auth_token_path() -> String {
    "token".into()
}

fn default_auth_username_field() -> String {
    "email".into()
}

fn default_auth_password_field() -> String {
    "password".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthConfig {
    pub login_endpoint: String,
    #[serde(default = "default_auth_token_path")]
    pub token_path: String,
    #[serde(default = "default_auth_username_field")]
    pub username_field: String,
    #[serde(default = "default_auth_password_field")]
    pub password_field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Branding {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub logo: Option<String>,
    #[serde(default)]
    pub primary_color: Option<String>,
    #[serde(default = "default_theme")]
    pub theme: Theme,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entity {
    pub name: String,
    pub endpoint: String,
    pub id_field: String,
    #[serde(default)]
    pub data_path: Option<String>,
    #[serde(default, alias = "itemPath")]
    pub row_path: Option<String>,
    #[serde(default)]
    pub actions: Vec<EntityAction>,
    #[serde(default)]
    pub columns: Option<Vec<Column>>,
    #[serde(default)]
    pub pagination: Option<Pagination>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntityAction {
    List,
    Detail,
    Create,
    Edit,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub field: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub searchable: bool,
    #[serde(default)]
    pub r#type: Option<ColumnType>,
    #[serde(default)]
    pub r#enum: Option<Vec<String>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ColumnType {
    Text,
    Number,
    Boolean,
    Date,
    Array,
    Object,
    Select,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pagination {
    #[serde(rename = "type")]
    pub pagination_type: PaginationType,
    #[serde(default = "default_page_size")]
    pub page_size: u32,
}

fn default_page_size() -> u32 {
    50
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaginationType {
    Offset,
    Cursor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvsFile {
    pub environments: HashMap<String, Environment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Environment {
    pub base_url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
}

impl AdminyoFile {
    pub fn validate(&self) -> Result<(), String> {
        if let Some(a) = &self.auth {
            if a.login_endpoint.trim().is_empty() {
                return Err("auth.loginEndpoint must not be empty".into());
            }
        }
        let mut seen = std::collections::HashSet::new();
        for (i, e) in self.entities.iter().enumerate() {
            if e.name.trim().is_empty() {
                return Err(format!("entities[{i}].name must not be empty"));
            }
            if e.endpoint.trim().is_empty() {
                return Err(format!("entities[{i}].endpoint must not be empty"));
            }
            if e.id_field.trim().is_empty() {
                return Err(format!("entities[{i}].idField must not be empty"));
            }
            if !seen.insert(e.name.as_str()) {
                return Err(format!("duplicate entity name: {}", e.name));
            }
            if let Some(cols) = &e.columns {
                for (j, c) in cols.iter().enumerate() {
                    if c.field.trim().is_empty() {
                        return Err(format!(
                            "entities[{i}].columns[{j}].field must not be empty"
                        ));
                    }
                    if let Some(ColumnType::Select) = c.r#type {
                        if c.r#enum.as_ref().is_none_or(|v| v.is_empty()) {
                            return Err(format!(
                                "entities[{i}].columns[{j}].type select requires enum"
                            ));
                        }
                    }
                }
            }
            if let Some(p) = &e.pagination {
                if p.page_size == 0 {
                    return Err(format!("entities[{i}].pagination.pageSize must be >= 1"));
                }
            }
        }
        Ok(())
    }
}

impl EnvsFile {
    pub fn validate(&self) -> Result<(), String> {
        if self.environments.is_empty() {
            return Err("environments must not be empty".into());
        }
        for (k, v) in &self.environments {
            if k.trim().is_empty() {
                return Err("environment name must not be empty".into());
            }
            if v.base_url.trim().is_empty() {
                return Err(format!("environments.{k}.baseUrl must not be empty"));
            }
            Url::parse(&v.base_url)
                .map_err(|e| format!("environments.{k}.baseUrl invalid URL: {e}"))?;
            for (hk, hv) in &v.headers {
                if hk.trim().is_empty() {
                    return Err(format!("environments.{k} has empty header name"));
                }
                if hv.is_empty() {
                    return Err(format!(
                        "environments.{k} header {hk} value must not be empty"
                    ));
                }
            }
        }
        Ok(())
    }
}
