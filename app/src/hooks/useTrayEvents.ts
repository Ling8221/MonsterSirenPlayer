import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/tauri";
import { usePlaybackStore } from "@/store/usePlaybackStore";

/** 托盘菜单的播放控制：Rust 侧只负责发事件，真正的状态留在前端。 */
export function useTrayEvents() {
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    const bind = async (event: string, handler: () => void): Promise<void> => {
      try {
        const unlisten = await listen(event, handler);
        if (disposed) unlisten();
        else unlisteners.push(unlisten);
      } catch (error) {
        console.warn(`[tray] 订阅 ${event} 失败`, error);
      }
    };

    void bind("tray://play-pause", () => usePlaybackStore.getState().toggle());
    void bind("tray://previous", () => usePlaybackStore.getState().previous());
    void bind("tray://next", () => usePlaybackStore.getState().next());

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
    };
  }, []);
}
