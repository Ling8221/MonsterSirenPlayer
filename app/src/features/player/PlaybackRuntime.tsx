import { useEffect } from "react";
import { audioEngine } from "@/play/audioEngine";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { toast } from "@/store/useToastStore";

/**
 * 把音频内核和播放状态接起来：
 * 自然播完 → 按模式决定下一首；系统媒体键 → 走同一套播放操作。
 */
export function PlaybackRuntime() {
  useEffect(() => {
    const offEnded = audioEngine.onEnded(() => {
      const playback = usePlaybackStore.getState();
      if (playback.mode === "single-loop") {
        audioEngine.seek(0);
        audioEngine.play();
        return;
      }
      playback.next(true);
    });

    const offError = audioEngine.onError((message) => {
      toast(message, "error");
    });

    audioEngine.updateMediaSessionHandlers({
      next: () => usePlaybackStore.getState().next(),
      previous: () => usePlaybackStore.getState().previous(),
      seekTo: (details) => {
        if (typeof details.seekTime === "number") audioEngine.seek(details.seekTime);
      },    });

    // 首次进入时把已持久化的音量写回音频元素。
    const { volume, muted } = usePlaybackStore.getState();
    audioEngine.setVolume(volume, muted);

    return () => {
      offEnded();
      offError();
    };
  }, []);

  return null;
}
