import { create } from "zustand";
import { isTauri } from "@/lib/tauri";
import type { Window } from "@tauri-apps/api/window";

interface WindowState {
  supported: boolean;
  maximized: boolean;
  init: () => void;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
}

let windowPromise: Promise<Window | null> | null = null;
let initPromise: Promise<void> | null = null;

/** 只动态导入并获取一次窗口对象，点击按钮时不再重复 import。 */
function getWindow(): Promise<Window | null> {
  if (!isTauri()) return Promise.resolve(null);
  if (!windowPromise) {
    windowPromise = import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow())
      .catch(() => null);
  }
  return windowPromise;
}

/**
 * 窗口控制状态：标题栏与沉浸式播放页共用同一份，避免各自注册 resize 监听。
 */
export const useWindowStore = create<WindowState>((set, get) => ({
  supported: isTauri(),
  maximized: false,

  init: () => {
    if (!get().supported || initPromise) return;
    initPromise = (async () => {
      const win = await getWindow();
      if (!win) return;

      const sync = async (): Promise<void> => {
        const value = await win.isMaximized().catch(() => false);
        set({ maximized: value });
      };

      await sync();
      await win.onResized(() => {
        void sync();
      });
    })().catch(() => {
      /* 非 Tauri 环境或窗口 API 不可用时忽略 */
    });
  },

  minimize: () => {
    void getWindow()
      .then((win) => win?.minimize())
      .catch(() => {});
  },

  toggleMaximize: () => {
    set({ maximized: !get().maximized });
    void getWindow()
      .then((win) => win?.toggleMaximize())
      .catch(() => {});
  },

  close: () => {
    void getWindow()
      .then((win) => win?.close())
      .catch(() => {});
  },
}));
