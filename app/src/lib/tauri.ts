import { invoke } from "@tauri-apps/api/core";

/**
 * 是否运行在 Tauri 里。
 *
 * 开发时 Tauri 会加载 http://localhost:1420，浏览器预览也是这个地址，
 * 因此不能靠 location 判断，必须看注入的内部对象。
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

export async function invokeTauri<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

/** 非 Tauri 环境下的安全降级：直接返回 null，由调用方决定回退策略。 */
export async function tryInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.warn(`[tauri] ${command} failed`, error);
    return null;
  }
}
