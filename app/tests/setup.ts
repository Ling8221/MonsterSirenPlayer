import { afterEach } from "vitest";

afterEach(() => {
  if (typeof document !== "undefined") document.body.innerHTML = "";
  if (typeof window !== "undefined") window.localStorage.clear();
});

if (typeof window !== "undefined") {
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver !== "function") {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  }

  // happy-dom 没有实现媒体元素，这里给一个够用的桩，避免播放内核在测试里报错。
  class AudioStub extends EventTarget {
    src = "";
    preload = "";
    duration = 30;
    currentTime = 0;
    volume = 1;
    muted = false;
    paused = true;
    error: MediaError | null = null;

    load(): void {}
    play(): Promise<void> {
      this.paused = false;
      return Promise.resolve();
    }
    pause(): void {
      this.paused = true;
    }
    removeAttribute(): void {}
  }

  if (typeof window.Audio !== "function") {
    Object.defineProperty(window, "Audio", { writable: true, value: AudioStub });
  }
}
