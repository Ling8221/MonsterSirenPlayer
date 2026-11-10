/**
 * 运行日志：把用户操作、播放事件、接口失败等持续写入 `logs/` 下的会话文件。
 *
 * 浏览器预览或测试环境（非 Tauri）下自动降级为 no-op，不影响任何逻辑。
 */
import { invokeTauri, isTauri } from "@/lib/tauri";

export type LogLevel = "info" | "warn" | "error";

const HEARTBEAT_MS = 10 * 60 * 1000;
const startedAt = Date.now();
let heartbeatTimer: number | null = null;

export function logEvent(level: LogLevel, message: string): void {
  if (!isTauri()) return;
  void invokeTauri("log_event", { level, message }).catch(() => {
    // 日志写入失败不能影响主流程（例如磁盘满、目录被删）。
  });
}

export const logInfo = (message: string): void => logEvent("info", message);
export const logWarn = (message: string): void => logEvent("warn", message);
export const logError = (message: string): void => logEvent("error", message);

/** 注册全局错误监听与心跳；重复调用只生效一次。 */
export function startRuntimeLogging(): void {
  if (!isTauri() || heartbeatTimer !== null) return;

  window.addEventListener("error", (event) => {
    logError(`window error: ${event.message || "unknown"}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    logError(`unhandled rejection: ${reason}`);
  });

  logInfo("runtime: logging started");
  heartbeatTimer = window.setInterval(() => {
    const minutes = Math.round((Date.now() - startedAt) / 60_000);
    logInfo(`heartbeat: uptime=${minutes}min`);
  }, HEARTBEAT_MS);
}
