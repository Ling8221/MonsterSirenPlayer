import { create } from "zustand";
import { logError, logWarn } from "@/lib/logger";

export interface AudioState {
  time: number;
  duration: number;
  playing: boolean;
  buffering: boolean;
  /** 音频元素是否已经拿到可播放的元数据 */
  ready: boolean;
  error: string | null;
}

export const useAudioStore = create<AudioState>(() => ({
  time: 0,
  duration: 0,
  playing: false,
  buffering: false,
  ready: false,
  error: null,
}));

type VoidListener = () => void;
type ErrorListener = (message: string) => void;

/**
 * 播放内核：只负责一个 <audio> 元素的生命周期与事件上报。
 * 队列、歌词、UI 都不直接碰它，避免旧版里多处改 audio.volume / audio.src 互相覆盖。
 */
class AudioEngine {
  private element: HTMLAudioElement | null = null;
  private endedListeners = new Set<VoidListener>();
  private errorListeners = new Set<ErrorListener>();
  private mediaSessionReady = false;

  get audio(): HTMLAudioElement {
    if (!this.element) this.element = this.createElement();
    return this.element;
  }

  private createElement(): HTMLAudioElement {
    const audio = new Audio();
    audio.preload = "auto";

    audio.addEventListener("loadedmetadata", () => {
      useAudioStore.setState({
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        ready: true,
      });
    });

    audio.addEventListener("durationchange", () => {
      useAudioStore.setState({
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      });
    });

    audio.addEventListener("timeupdate", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      useAudioStore.setState({
        time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        duration,
      });
    });

    audio.addEventListener("play", () => {
      useAudioStore.setState({ playing: true, buffering: false });
      this.updateMediaSessionState("playing");
    });

    audio.addEventListener("pause", () => {
      useAudioStore.setState({ playing: false });
      this.updateMediaSessionState("paused");
    });

    audio.addEventListener("waiting", () => {
      useAudioStore.setState({ buffering: true });
    });

    audio.addEventListener("playing", () => {
      useAudioStore.setState({ buffering: false, ready: true });
    });

    audio.addEventListener("canplay", () => {
      useAudioStore.setState({ buffering: false, ready: true });
    });

    audio.addEventListener("ended", () => {
      useAudioStore.setState({ playing: false });
      for (const listener of this.endedListeners) listener();
    });

    audio.addEventListener("error", () => {
      // 切换 src / 主动停止时也会触发 error，此时没有有效 src，忽略即可。
      if (!audio.getAttribute("src")) return;
      const code = audio.error?.code ?? 0;
      if (code === 1) return; // MEDIA_ERR_ABORTED：用户主动打断，不算错误
      const message =
        code === 2
          ? "网络中断，无法加载音频"
          : code === 3
            ? "音频解码失败"
            : code === 4
              ? "音频格式不受支持或地址已失效"
              : "音频播放出错";
      useAudioStore.setState({ error: message, playing: false, buffering: false });
      logError(`audio: ${message} (code=${code})`);
      for (const listener of this.errorListeners) listener(message);
    });

    this.setupMediaSession();
    return audio;
  }

  onEnded(listener: VoidListener): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  load(url: string): void {
    const audio = this.audio;
    audio.src = url;
    audio.load();
    useAudioStore.setState({ time: 0, duration: 0, ready: false, error: null, buffering: true });
  }

  play(): void {
    const audio = this.audio;
    const started = audio.play();
    if (started && typeof started.catch === "function") {
      started.catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (/NotAllowedError/i.test(message)) {
          // 自动播放被拦截：保持暂停状态，让用户点一下播放键。
          useAudioStore.setState({ playing: false });
          return;
        }
        logWarn(`audio: play failed: ${message}`);
        useAudioStore.setState({ error: "无法开始播放", playing: false });
      });
    }
  }

  pause(): void {
    this.audio.pause();
  }

  stop(): void {
    const audio = this.element;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    useAudioStore.setState({ time: 0, duration: 0, ready: false, playing: false, buffering: false });
  }

  seek(seconds: number): void {
    const audio = this.audio;
    if (!Number.isFinite(seconds)) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const target = duration > 0 ? Math.min(Math.max(seconds, 0), duration) : Math.max(seconds, 0);
    try {
      audio.currentTime = target;
      useAudioStore.setState({ time: target });
    } catch {
      /* 元数据尚未就绪时忽略 */
    }
  }

  setVolume(volume: number, muted: boolean): void {
    const audio = this.audio;
    audio.muted = muted;
    audio.volume = Math.min(Math.max(volume, 0), 1);
  }

  private setupMediaSession(): void {
    if (this.mediaSessionReady) return;
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    this.mediaSessionReady = true;
    try {
      navigator.mediaSession.setActionHandler("play", () => this.play());
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
    } catch {
      /* 部分环境不支持 */
    }
  }

  /** 由播放层调用，同步系统媒体面板的歌曲信息。 */
  updateMediaSessionMetadata(info: { title: string; artist: string; album: string; artwork?: string }): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      const artwork = info.artwork
        ? [{ src: info.artwork, sizes: "512x512", type: "image/jpeg" }]
        : [];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: info.title,
        artist: info.artist,
        album: info.album,
        artwork,
      });
    } catch {
      /* ignore */
    }
  }

  updateMediaSessionHandlers(handlers: {
    next?: () => void;
    previous?: () => void;
    seekTo?: (details: MediaSessionActionDetails) => void;
  }): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      if (handlers.next) navigator.mediaSession.setActionHandler("nexttrack", handlers.next);
      if (handlers.previous) navigator.mediaSession.setActionHandler("previoustrack", handlers.previous);
      if (handlers.seekTo) navigator.mediaSession.setActionHandler("seekto", handlers.seekTo);
    } catch {
      /* ignore */
    }
  }

  private updateMediaSessionState(state: MediaSessionPlaybackState): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch {
      /* ignore */
    }
  }
}

export const audioEngine = new AudioEngine();
