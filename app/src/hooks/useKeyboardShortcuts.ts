import { useEffect } from "react";
import { audioEngine } from "@/play/audioEngine";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useUiStore } from "@/store/useUiStore";

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
}

/** 空格在获得焦点的按钮上会触发按钮本身，避免同时切换了播放。 */
function isButtonTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.tagName === "BUTTON" || element.getAttribute("role") === "button";
}

/** 全局快捷键：空格播放/暂停，左右方向键快退快进，M 静音，Esc 逐层关闭。 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        const ui = useUiStore.getState();
        if (ui.dialog) {
          ui.closeDialog();
          return;
        }
        if (ui.queueOpen) {
          ui.closeQueue();
          return;
        }
        if (ui.nowPlayingOpen) {
          ui.closeNowPlaying();
          return;
        }
        ui.back();
        return;
      }

      if (event.code === "Space") {
        if (isButtonTarget(event.target)) return;
        event.preventDefault();
        usePlaybackStore.getState().toggle();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        audioEngine.seek(audioEngine.audio.currentTime + 5);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        audioEngine.seek(audioEngine.audio.currentTime - 5);
        return;
      }

      if ((event.key === "m" || event.key === "M") && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        usePlaybackStore.getState().toggleMute();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
