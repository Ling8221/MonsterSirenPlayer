import { useEffect } from "react";
import { waitForHydration } from "@/lib/hydration";
import { isTauri } from "@/lib/tauri";
import { useSettingsStore } from "@/store/useSettingsStore";

/**
 * 窗口尺寸记忆：启动时恢复上次的尺寸/位置，运行中在缩放或移动后写入设置。
 * 非 Tauri 环境或未开启「记住窗口大小」时不做任何事。
 */
export function useWindowPersistence(): void {
  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    let saveTimer: number | null = null;
    const unlisten: Array<() => void> = [];

    void (async () => {
      try {
        const { getCurrentWindow, PhysicalPosition, PhysicalSize } = await import(
          "@tauri-apps/api/window"
        );
        const win = getCurrentWindow();
        if (disposed) return;

        await waitForHydration(useSettingsStore);
        if (disposed) return;

        const initial = useSettingsStore.getState();
        if (initial.rememberWindowSize && initial.windowBounds) {
          const bounds = initial.windowBounds;
          try {
            await win.setSize(new PhysicalSize(bounds.width, bounds.height));
            if (bounds.x !== undefined && bounds.y !== undefined) {
              await win.setPosition(new PhysicalPosition(bounds.x, bounds.y));
            }
            if (bounds.maximized) await win.maximize();
          } catch (error) {
            console.warn("[window] 恢复窗口尺寸失败", error);
          }
        }

        const capture = async (): Promise<void> => {
          if (disposed) return;
          const state = useSettingsStore.getState();
          if (!state.rememberWindowSize) return;
          try {
            const maximized = await win.isMaximized();
            if (maximized) {
              if (state.windowBounds) {
                state.setWindowBounds({ ...state.windowBounds, maximized: true });
              }
              return;
            }
            const size = await win.outerSize();
            const position = await win.outerPosition();
            if (size.width <= 0 || size.height <= 0) return;
            state.setWindowBounds({
              width: size.width,
              height: size.height,
              x: position.x,
              y: position.y,
              maximized: false,
            });
          } catch {
            /* 窗口 API 不可用时忽略 */
          }
        };

        const schedule = (): void => {
          if (saveTimer !== null) window.clearTimeout(saveTimer);
          saveTimer = window.setTimeout(() => {
            saveTimer = null;
            void capture();
          }, 500);
        };

        // 用户重新打开「记住窗口大小」时，立即记录一次当前窗口。
        const unsubscribe = useSettingsStore.subscribe((state, previous) => {
          if (state.rememberWindowSize && !previous.rememberWindowSize) schedule();
        });
        unlisten.push(unsubscribe);

        unlisten.push(
          await win.onResized(() => {
            schedule();
          }),
        );
        unlisten.push(
          await win.onMoved(() => {
            schedule();
          }),
        );

        const current = useSettingsStore.getState();
        if (current.rememberWindowSize && !current.windowBounds) void capture();
      } catch (error) {
        console.warn("[window] 窗口记忆不可用", error);
      }
    })();

    return () => {
      disposed = true;
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      for (const stop of unlisten) stop();
      unlisten.length = 0;
    };
  }, []);
}
