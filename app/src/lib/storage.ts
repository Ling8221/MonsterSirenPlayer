import { isTauri, tryInvoke } from "./tauri";
import type { StateStorage } from "zustand/middleware";

/**
 * 持久化适配层。
 *
 * Tauri 里写应用数据目录下的文件（由 Rust 侧保证原子写入），
 * 浏览器预览 / 单元测试里退化为 localStorage + 内存。
 */
const memory = new Map<string, string>();
const KEY_PATTERN = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`非法的存储键名：${key}`);
  }
}

function localGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 隐私模式或超出配额时忽略 */
  }
}

function localRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export async function readStorage(key: string): Promise<string | null> {
  assertKey(key);
  if (isTauri()) {
    const value = await tryInvoke<string | null>("storage_read", { key });
    if (value !== null && value !== undefined) return value;
    return value ?? null;
  }
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return localGet(key);
  }
  return memory.get(key) ?? null;
}

export async function writeStorage(key: string, value: string): Promise<void> {
  assertKey(key);
  if (isTauri()) {
    await tryInvoke("storage_write", { key, data: value });
    return;
  }
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    localSet(key, value);
    return;
  }
  memory.set(key, value);
}

export async function removeStorage(key: string): Promise<void> {
  assertKey(key);
  if (isTauri()) {
    await tryInvoke("storage_remove", { key });
    return;
  }
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    localRemove(key);
    return;
  }
  memory.delete(key);
}

export async function readJson<T>(key: string): Promise<T | null> {
  const raw = await readStorage(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[storage] 无法解析 ${key}，已忽略`);
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await writeStorage(key, JSON.stringify(value));
}

/** zustand/persist 使用的异步 Storage。 */
export const persistentStorage: StorageAdapter = {
  getItem: readStorage,
  setItem: writeStorage,
  removeItem: removeStorage,
};

const sectionQueues = new Map<string, Promise<void>>();

function enqueueWrite(file: string, task: () => Promise<void>): Promise<void> {
  const previous = sectionQueues.get(file) ?? Promise.resolve();
  const next = previous.then(task, task);
  sectionQueues.set(file, next.catch(() => {}));
  return next;
}

/**
 * 把多个 zustand store 合并进同一个 JSON 文件的适配器。
 *
 * 文件结构：`{ "favorites": {...}, "playlists": {...} }`。
 * 旧版本单独写在 favorites.json / playlists.json 的数据会自动作为回退读取。
 */
export function createSectionStorage(file: string): StateStorage {
  return {
    async getItem(name) {
      const data = await readJson<Record<string, unknown>>(file);
      const value = data?.[name];
      if (value !== undefined) return JSON.stringify(value);

      if (name === "favorites" || name === "playlists") {
        const legacy = await readJson<unknown>(name);
        if (legacy) return JSON.stringify(legacy);
      }
      return null;
    },

    setItem(name, value) {
      const parsed = JSON.parse(value) as unknown;
      return enqueueWrite(file, async () => {
        const data = (await readJson<Record<string, unknown>>(file)) ?? {};
        data[name] = parsed;
        await writeJson(file, data);
      });
    },

    removeItem(name) {
      return enqueueWrite(file, async () => {
        const data = (await readJson<Record<string, unknown>>(file)) ?? {};
        delete data[name];
        await writeJson(file, data);
      });
    },
  };
}

/** 把旧版分散存储迁移到 settings / library / session 三个文件。 */
export async function migrateStorageLayout(): Promise<void> {
  try {
    if (!(await readJson("library"))) {
      const favorites = await readJson<unknown>("favorites");
      const playlists = await readJson<unknown>("playlists");
      if (favorites || playlists) {
        const data: Record<string, unknown> = {};
        if (favorites) data.favorites = favorites;
        if (playlists) data.playlists = playlists;
        await writeJson("library", data);
      }
    }

    if (!(await readJson("session"))) {
      const legacy = await readJson<unknown>("playback");
      if (legacy) await writeJson("session", legacy);
    }

    if (!(await readJson("cache/library"))) {
      const legacy = await readJson<unknown>("library-cache");
      if (legacy) await writeJson("cache/library", legacy);
    }

    // 新文件就绪后再清理旧文件，避免中途失败丢数据。
    if (await readJson("library")) {
      await removeStorage("favorites").catch(() => {});
      await removeStorage("playlists").catch(() => {});
    }
    if (await readJson("session")) await removeStorage("playback").catch(() => {});
    if (await readJson("cache/library")) await removeStorage("library-cache").catch(() => {});
    await removeStorage("legacy-migrated").catch(() => {});
  } catch (error) {
    console.warn("[storage] 迁移存储布局失败", error);
  }
}

/** 仅测试使用：清空内存兜底。 */
export function __resetMemoryStorage(): void {
  memory.clear();
}
