import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { invokeTauri, isTauri } from "@/lib/tauri";
import { logInfo } from "@/lib/logger";
import { persistentStorage } from "@/lib/storage";
import {
  applyFont,
  applyThemeColor,
  applyThemeMode,
  applyUiScale,
  clampLogKb,
  clampUiScale,
  DEFAULT_FONT_FAMILY,
  DEFAULT_LOG_KB,
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_MODE,
  DEFAULT_UI_SCALE,
  normalizeFontFamily,
  type ThemeMode,
} from "@/lib/theme";

export interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

export type CloseBehavior = "tray" | "exit";

interface SettingsState {
  themeColor: string;
  themeMode: ThemeMode;
  uiScale: number;
  rememberWindowSize: boolean;
  closeBehavior: CloseBehavior;
  windowBounds: WindowBounds | null;
  /** 系统字体家族名；空字符串表示使用内置 MiSans VF。 */
  fontFamily: string;
  logMaxKb: number;
  hydrated: boolean;
  setThemeColor: (value: string) => void;
  setThemeMode: (value: ThemeMode) => void;
  setUiScale: (value: number) => void;
  setRememberWindowSize: (value: boolean) => void;
  setCloseBehavior: (value: CloseBehavior) => void;
  setWindowBounds: (value: WindowBounds) => void;
  setFontFamily: (value: string) => void;
  setLogMaxKb: (value: number) => void;
  markHydrated: () => void;
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === "dark" || value === "light" || value === "system" ? value : DEFAULT_THEME_MODE;
}

function normalizeWindowBounds(value: unknown): WindowBounds | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WindowBounds>;
  if (!Number.isFinite(candidate.width) || !Number.isFinite(candidate.height)) return null;
  if ((candidate.width ?? 0) <= 0 || (candidate.height ?? 0) <= 0) return null;
  return {
    width: Math.round(candidate.width as number),
    height: Math.round(candidate.height as number),
    x: Number.isFinite(candidate.x) ? Math.round(candidate.x as number) : undefined,
    y: Number.isFinite(candidate.y) ? Math.round(candidate.y as number) : undefined,
    maximized: Boolean(candidate.maximized),
  };
}

async function syncLogLimit(kb: number): Promise<void> {
  if (!isTauri()) return;
  try {
    await invokeTauri<number>("set_log_limit", { kb });
  } catch (error) {
    console.warn("[settings] 同步日志上限失败", error);
  }
}

async function syncCloseBehavior(behavior: CloseBehavior): Promise<void> {
  if (!isTauri()) return;
  try {
    await invokeTauri("set_close_behavior", { behavior });
  } catch (error) {
    console.warn("[settings] 同步关闭行为失败", error);
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeColor: DEFAULT_THEME_COLOR,
      themeMode: DEFAULT_THEME_MODE,
      uiScale: DEFAULT_UI_SCALE,
      rememberWindowSize: true,
      closeBehavior: "tray",
      windowBounds: null,
      fontFamily: DEFAULT_FONT_FAMILY,
      logMaxKb: DEFAULT_LOG_KB,
      hydrated: false,

      setThemeColor: (value) => {
        applyThemeColor(value);
        set({ themeColor: value });
      },

      setThemeMode: (value) => {
        const mode = normalizeThemeMode(value);
        logInfo(`settings: theme mode ${mode}`);
        applyThemeMode(mode);
        set({ themeMode: mode });
      },

      setUiScale: (value) => {
        const scale = clampUiScale(value);
        logInfo(`settings: ui scale ${scale}`);
        applyUiScale(scale);
        set({ uiScale: scale });
      },

      setRememberWindowSize: (value) => {
        logInfo(`settings: remember window size ${value}`);
        set({ rememberWindowSize: value });
      },

      setCloseBehavior: (value) => {
        const behavior: CloseBehavior = value === "exit" ? "exit" : "tray";
        logInfo(`settings: close behavior ${behavior}`);
        set({ closeBehavior: behavior });
        void syncCloseBehavior(behavior);
      },

      setWindowBounds: (value) => {
        const bounds = normalizeWindowBounds(value);
        if (bounds) set({ windowBounds: bounds });
      },

      setFontFamily: (value) => {
        const family = normalizeFontFamily(value);
        logInfo(`settings: font "${family || "MiSans VF"}"`);
        applyFont(family);
        set({ fontFamily: family });
      },

      setLogMaxKb: (value) => {
        const kb = clampLogKb(value);
        logInfo(`settings: log limit ${kb}KB`);
        set({ logMaxKb: kb });
        void syncLogLimit(kb);
      },

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "settings",
      version: 2,
      storage: createJSONStorage(() => persistentStorage),
      migrate: (persisted) => persisted as SettingsState,
      partialize: (state) => ({
        themeColor: state.themeColor,
        themeMode: state.themeMode,
        uiScale: state.uiScale,
        rememberWindowSize: state.rememberWindowSize,
        closeBehavior: state.closeBehavior,
        windowBounds: state.windowBounds,
        fontFamily: state.fontFamily,
        logMaxKb: state.logMaxKb,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...saved,
          themeMode: normalizeThemeMode(saved.themeMode),
          uiScale: clampUiScale(Number(saved.uiScale ?? DEFAULT_UI_SCALE)),
          rememberWindowSize: saved.rememberWindowSize !== false,
          closeBehavior: saved.closeBehavior === "exit" ? "exit" : "tray",
          windowBounds: normalizeWindowBounds(saved.windowBounds),
          fontFamily: normalizeFontFamily(saved.fontFamily),
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn("[settings] 读取设置失败", error);
        if (state) {
          applyThemeMode(state.themeMode);
          applyUiScale(state.uiScale);
          applyThemeColor(state.themeColor);
          applyFont(state.fontFamily);
          void syncLogLimit(state.logMaxKb);
          void syncCloseBehavior(state.closeBehavior);
        }
        state?.markHydrated();
      },
    },
  ),
);

// 首帧先上默认外观，持久化设置随后覆盖，避免未定义变量。
applyThemeMode(DEFAULT_THEME_MODE);
applyUiScale(DEFAULT_UI_SCALE);
applyThemeColor(DEFAULT_THEME_COLOR);
applyFont(DEFAULT_FONT_FAMILY);
