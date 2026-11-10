import { invokeTauri, isTauri } from "./tauri";

/**
 * 封面兜底加载。
 *
 * 正常情况下 <img> 直接加载 CDN 图片；如果 WebView 因为防盗链拿不到，
 * 再让 Rust 侧带 Referer 重新抓取并以 data URL 返回。
 * 结果做一个小容量 LRU，避免同一张封面反复请求。
 */
const MAX_ENTRIES = 48;
const resolved = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export function peekCoverFallback(url: string): string | null | undefined {
  return resolved.get(url);
}

export function resolveCoverFallback(url: string): Promise<string | null> {
  const cached = resolved.get(url);
  if (cached !== undefined) return Promise.resolve(cached);

  const running = inflight.get(url);
  if (running) return running;

  const task = (async () => {
    if (!url || !/^https?:\/\//i.test(url)) return null;
    if (!isTauri()) return null;
    try {
      const dataUrl = await invokeTauri<string>("fetch_image", { url });
      remember(url, dataUrl || null);
      return dataUrl || null;
    } catch (error) {
      console.warn("[cover] 兜底加载失败", url, error);
      remember(url, null);
      return null;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, task);
  return task;
}

function remember(url: string, value: string | null): void {
  if (resolved.size >= MAX_ENTRIES) {
    const oldest = resolved.keys().next();
    if (!oldest.done) resolved.delete(oldest.value);
  }
  resolved.set(url, value);
}

/** 仅测试使用。 */
export function __resetCoverCache(): void {
  resolved.clear();
  inflight.clear();
}
