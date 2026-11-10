import type {
  ApiEnvelope,
  RawAlbum,
  RawAlbumDetail,
  RawSong,
  RawSongDetail,
  RawSongList,
} from "./types";
import { isMockMode, mockSongDetail } from "@/data/mock";
import { invokeTauri, isTauri } from "@/lib/tauri";

export const API_ORIGIN = "https://monster-siren.hypergryph.com";
export const API_BASE = `${API_ORIGIN}/api`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function parseEnvelope<T>(text: string, path: string): T {
  let payload: ApiEnvelope<T>;
  try {
    payload = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new ApiError("服务器返回了无法解析的内容", path);
  }
  if (typeof payload.code === "number" && payload.code !== 0) {
    throw new ApiError(payload.msg?.trim() || `接口错误（code ${payload.code}）`, path);
  }
  if (payload.data === undefined) {
    throw new ApiError(payload.msg?.trim() || "接口没有返回数据", path);
  }
  return payload.data;
}

/**
 * 统一请求入口。
 * - Tauri：走 Rust 端命令，避免 WebView 的 CORS 与防盗链限制。
 * - 浏览器：走 Vite 代理（仅开发调试可用）。
 */
async function requestText(path: string): Promise<string> {
  if (isTauri()) {
    return invokeTauri<string>("api_get", { path });
  }
  const response = await fetch(`/api${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new ApiError(`请求失败（HTTP ${response.status}）`, path);
  }
  return response.text();
}

async function request<T>(path: string): Promise<T> {
  return parseEnvelope<T>(await requestText(path), path);
}

export async function fetchSongList(): Promise<RawSong[]> {
  const data = await request<RawSongList>("/songs");
  return Array.isArray(data.list) ? data.list : [];
}

export async function fetchAlbumList(): Promise<RawAlbum[]> {
  const data = await request<RawAlbum[]>("/albums");
  return Array.isArray(data) ? data : [];
}

export async function fetchAlbumDetail(cid: string): Promise<RawAlbumDetail> {
  return request<RawAlbumDetail>(`/album/${encodeURIComponent(cid)}/detail`);
}

export async function fetchSongDetail(cid: string): Promise<RawSongDetail> {
  if (isMockMode()) {
    const mock = await mockSongDetail(cid);
    if (!mock) throw new ApiError("演示数据里没有这首歌", `/song/${cid}`);
    return mock;
  }
  return request<RawSongDetail>(`/song/${encodeURIComponent(cid)}`);
}

/**
 * 歌词与封面走 CDN，同样需要绕过 WebView 的跨域限制。
 * 浏览器环境下先尝试开发代理 /hycdn，再回退直连。
 */
export async function fetchRemoteText(url: string): Promise<string> {
  if (url.startsWith("/mock/")) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`本地演示资源缺失（HTTP ${response.status}）`);
    return response.text();
  }
  if (isTauri()) {
    return invokeTauri<string>("fetch_text", { url });
  }
  const proxied = url.startsWith("https://web.hycdn.cn")
    ? url.replace("https://web.hycdn.cn", "/hycdn")
    : url;
  const response = await fetch(proxied);
  if (!response.ok) throw new Error(`歌词请求失败（HTTP ${response.status}）`);
  return response.text();
}
