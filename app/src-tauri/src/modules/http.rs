//! 网络访问集中在这里：WebView 里发请求会撞上 CORS 与防盗链，
//! 因此接口、歌词、封面兜底都改由 Rust 侧代取。

use std::sync::OnceLock;
use std::time::Duration;

use base64::Engine as _;
use encoding_rs::{GB18030, UTF_8};
use reqwest::header::{HeaderMap, ACCEPT, CONTENT_TYPE, REFERER};
use reqwest::{Client, Response, Url};

const API_BASE: &str = "https://monster-siren.hypergryph.com/api";
const SITE_REFERER: &str = "https://monster-siren.hypergryph.com/";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                          (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const MAX_TEXT_BYTES: usize = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES: usize = 8 * 1024 * 1024;

fn client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(20))
            .connect_timeout(Duration::from_secs(8))
            .user_agent(USER_AGENT)
            .build()
            .expect("无法初始化 HTTP 客户端")
    })
}

/// 只允许访问塞壬唱片与其 CDN，避免命令变成任意地址代理。
fn parse_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|err| format!("非法地址：{err}"))?;
    match url.scheme() {
        "https" | "http" => {}
        other => return Err(format!("不支持的协议：{other}")),
    }
    let host = url.host_str().ok_or_else(|| "地址缺少主机名".to_string())?;
    let allowed = host == "monster-siren.hypergryph.com"
        || host == "hycdn.cn"
        || host.ends_with(".hycdn.cn");
    if !allowed {
        return Err(format!("不允许访问的主机：{host}"));
    }
    Ok(url)
}

fn header_value(headers: &HeaderMap, name: reqwest::header::HeaderName) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
}

/// 歌词文件既有 UTF-8 也有 GBK 历史文件，UTF-8 不合法时回退到 GB18030。
fn decode_text(bytes: &[u8], content_type: Option<&str>) -> String {
    if let Some(content_type) = content_type {
        let lower = content_type.to_ascii_lowercase();
        if lower.contains("gbk") || lower.contains("gb2312") || lower.contains("gb18030") {
            let (text, _, _) = GB18030.decode(bytes);
            return text.into_owned();
        }
    }

    if let Some(text) = UTF_8.decode_without_bom_handling_and_without_replacement(bytes) {
        return text.into_owned();
    }

    let (text, _, _) = GB18030.decode(bytes);
    text.into_owned()
}

async fn read_body(response: Response, limit: usize) -> Result<Vec<u8>, String> {
    let status = response.status();
    if !status.is_success() {
        return Err(format!("请求返回 HTTP {status}"));
    }

    let content_length = response.content_length().unwrap_or(0);
    if content_length > limit as u64 {
        return Err("响应体过大".to_string());
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("读取响应失败：{err}"))?;

    if bytes.len() > limit {
        return Err("响应体过大".to_string());
    }

    Ok(bytes.to_vec())
}

#[tauri::command]
pub async fn api_get(path: String) -> Result<String, String> {
    let normalized = if path.starts_with('/') {
        path
    } else {
        format!("/{path}")
    };
    let url = Url::parse(&format!("{API_BASE}{normalized}"))
        .map_err(|err| format!("非法接口路径：{err}"))?;

    let response = client()
        .get(url)
        .header(REFERER, SITE_REFERER)
        .header(ACCEPT, "application/json")
        .send()
        .await
        .map_err(|err| format!("接口请求失败：{err}"))?;

    let content_type = header_value(response.headers(), CONTENT_TYPE);
    let bytes = read_body(response, MAX_TEXT_BYTES).await?;
    Ok(decode_text(&bytes, content_type.as_deref()))
}

#[tauri::command]
pub async fn fetch_text(url: String) -> Result<String, String> {
    let parsed = parse_url(&url)?;

    let response = client()
        .get(parsed)
        .header(REFERER, SITE_REFERER)
        .send()
        .await
        .map_err(|err| format!("歌词请求失败：{err}"))?;

    let content_type = header_value(response.headers(), CONTENT_TYPE);
    let bytes = read_body(response, MAX_TEXT_BYTES).await?;
    Ok(decode_text(&bytes, content_type.as_deref()))
}

/// 封面兜底：带 Referer 取回图片并转成 data URL，WebView 可直接显示。
#[tauri::command]
pub async fn fetch_image(url: String) -> Result<String, String> {
    let parsed = parse_url(&url)?;

    let response = client()
        .get(parsed)
        .header(REFERER, SITE_REFERER)
        .send()
        .await
        .map_err(|err| format!("封面请求失败：{err}"))?;

    let content_type = header_value(response.headers(), CONTENT_TYPE)
        .unwrap_or_else(|| "image/jpeg".to_string());
    let mime = content_type
        .split(';')
        .next()
        .unwrap_or("image/jpeg")
        .trim()
        .to_string();

    if !mime.starts_with("image/") {
        return Err(format!("返回内容不是图片：{mime}"));
    }

    let bytes = read_body(response, MAX_IMAGE_BYTES).await?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}
