pub mod schema;

use anyhow::{Context, Result};
use schema::{AdminyoFile, Entity, Environment, EnvsFile};
use std::collections::HashMap;
use std::env;
use std::path::{Path, PathBuf};

pub fn load_adminyo(path: &Path) -> Result<AdminyoFile> {
    let s = std::fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
    let v: AdminyoFile = serde_yml::from_str(&s).context("parse adminyo.yml")?;
    v.validate().map_err(|e| anyhow::anyhow!(e))?;
    Ok(v)
}

pub fn load_envs(path: &Path) -> Result<EnvsFile> {
    let s = std::fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
    let v: EnvsFile = serde_yml::from_str(&s).context("parse envs.yml")?;
    v.validate().map_err(|e| anyhow::anyhow!(e))?;
    Ok(v)
}

pub fn interpolate_env(value: &str) -> Result<String> {
    let mut out = String::with_capacity(value.len());
    let mut rest = value;
    while let Some(start) = rest.find("${") {
        out.push_str(&rest[..start]);
        rest = &rest[start + 2..];
        let end = rest
            .find('}')
            .ok_or_else(|| anyhow::anyhow!("unclosed ${{ in value"))?;
        let name = rest[..end].trim();
        if name.is_empty() {
            return Err(anyhow::anyhow!("empty ${{}} placeholder"));
        }
        let val =
            env::var(name).with_context(|| format!("missing env var for placeholder: {name}"))?;
        out.push_str(&val);
        rest = &rest[end + 1..];
    }
    out.push_str(rest);
    Ok(out)
}

pub fn resolve_environment(raw: &Environment) -> Result<ResolvedEnvironment> {
    let base_url = interpolate_env(raw.base_url.trim())?;
    let mut headers = HashMap::new();
    for (k, v) in &raw.headers {
        headers.insert(k.clone(), interpolate_env(v)?);
    }
    Ok(ResolvedEnvironment { base_url, headers })
}

#[derive(Debug, Clone)]
pub struct ResolvedEnvironment {
    pub base_url: String,
    pub headers: HashMap<String, String>,
}

pub fn contrast_foreground_hsl(primary_color: &str) -> Option<String> {
    let (r, g, b) = parse_hex_rgb(primary_color)?;
    let lum = relative_luminance_u8(r, g, b);
    if lum > 0.179 {
        Some("0 0% 9%".into())
    } else {
        Some("210 40% 98%".into())
    }
}

fn channel_linear(c: f64) -> f64 {
    let c = c / 255.0;
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn relative_luminance_u8(r: u8, g: u8, b: u8) -> f64 {
    let r = channel_linear(r as f64);
    let g = channel_linear(g as f64);
    let b = channel_linear(b as f64);
    0.2126 * r + 0.7152 * g + 0.0722 * b
}

fn parse_hex_rgb(s: &str) -> Option<(u8, u8, u8)> {
    let s = s.trim();
    let s = s.strip_prefix('#')?;
    let bytes = match s.len() {
        3 => {
            let mut out = [0u8; 3];
            for (i, ch) in s.chars().enumerate() {
                let v = ch.to_digit(16)? as u8;
                out[i] = v * 16 + v;
            }
            out
        }
        6 => {
            let r = u8::from_str_radix(&s[0..2], 16).ok()?;
            let g = u8::from_str_radix(&s[2..4], 16).ok()?;
            let b = u8::from_str_radix(&s[4..6], 16).ok()?;
            [r, g, b]
        }
        8 => {
            let r = u8::from_str_radix(&s[0..2], 16).ok()?;
            let g = u8::from_str_radix(&s[2..4], 16).ok()?;
            let b = u8::from_str_radix(&s[4..6], 16).ok()?;
            [r, g, b]
        }
        _ => return None,
    };
    Some((bytes[0], bytes[1], bytes[2]))
}

pub fn canonicalize_logo_path(config_dir: &Path, logo_rel: &str) -> Result<PathBuf> {
    let p = PathBuf::from(logo_rel);
    if p.is_absolute() {
        anyhow::bail!("logo path must be relative");
    }
    let joined = config_dir.join(&p);
    let canon = joined
        .canonicalize()
        .with_context(|| format!("logo path not found: {}", joined.display()))?;
    let base = config_dir
        .canonicalize()
        .unwrap_or_else(|_| config_dir.to_path_buf());
    if !canon.starts_with(&base) {
        anyhow::bail!("logo path escapes project directory");
    }
    Ok(canon)
}

pub fn entity_slug(name: &str) -> String {
    let lower = name.to_lowercase();
    let mut out = String::new();
    let mut last_dash = true;
    for c in lower.chars() {
        if c.is_whitespace() {
            if !last_dash {
                out.push('-');
                last_dash = true;
            }
        } else if c.is_ascii_alphanumeric() || c == '-' {
            out.push(c);
            last_dash = false;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() {
        "entity".into()
    } else {
        out
    }
}

pub fn assign_entity_slugs(entities: &[Entity]) -> Vec<String> {
    let mut used = HashMap::<String, ()>::new();
    let mut slugs = Vec::new();
    for e in entities {
        let base = entity_slug(&e.name);
        let mut candidate = base.clone();
        let mut n = 2u32;
        while used.contains_key(&candidate) {
            candidate = format!("{base}-{n}");
            n += 1;
        }
        used.insert(candidate.clone(), ());
        slugs.push(candidate);
    }
    slugs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interpolate_basic() {
        env::set_var("T1", "hello");
        assert_eq!(interpolate_env("a ${T1} b").unwrap(), "a hello b");
    }

    #[test]
    fn interpolate_missing_var() {
        env::remove_var("MISSING_XYZ_123");
        assert!(interpolate_env("${MISSING_XYZ_123}").is_err());
    }

    #[test]
    fn slug_from_name() {
        assert_eq!(entity_slug("Usuarios"), "usuarios");
        assert_eq!(entity_slug("Foo Bar"), "foo-bar");
        assert_eq!(entity_slug("A!@#B"), "ab");
    }

    #[test]
    fn contrast_light_on_dark_primary() {
        assert_eq!(
            contrast_foreground_hsl("#6C5CE7").as_deref(),
            Some("210 40% 98%")
        );
    }

    #[test]
    fn contrast_dark_on_light_primary() {
        assert_eq!(contrast_foreground_hsl("#F5F5F5").as_deref(), Some("0 0% 9%"));
    }
}
