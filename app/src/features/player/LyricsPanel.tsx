import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Music4 } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/State";
import { activeLineIndex } from "@/lib/lrc";
import { audioEngine, useAudioStore } from "@/play/audioEngine";
import { useLyricsStore } from "@/store/useLyricsStore";

const MANUAL_RESET_DELAY = 3500;

interface LyricsPanelProps {
  /** 面板可见时才值得测量高度 */
  visible?: boolean;
}

export function LyricsPanel({ visible = true }: LyricsPanelProps) {
  const status = useLyricsStore((state) => state.status);
  const lyrics = useLyricsStore((state) => state.document);
  const error = useLyricsStore((state) => state.error);

  const lines = lyrics?.lines ?? [];
  const activeIndex = useAudioStore((state) =>
    lines.length > 0 ? activeLineIndex(lines, state.time) : -1,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [centers, setCenters] = useState<number[]>([]);
  const [viewport, setViewport] = useState(0);
  const [innerHeight, setInnerHeight] = useState(0);
  const [manual, setManual] = useState(0);
  const resetTimer = useRef<number | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const height = container.clientHeight;
    const padding = Math.max(24, Math.round(height / 2));
    inner.style.paddingTop = `${padding}px`;
    inner.style.paddingBottom = `${padding}px`;

    const elements = inner.querySelectorAll<HTMLElement>("[data-lyric-line]");
    const next: number[] = [];
    elements.forEach((element) => {
      next.push(element.offsetTop + element.offsetHeight / 2);
    });

    setCenters(next);
    setInnerHeight(inner.offsetHeight);
    setViewport(height);
  }, []);

  // 面板挂载 / 歌词变化时重新测量；窗口尺寸变化同样要重算。
  useLayoutEffect(() => {
    if (!visible) return;
    measure();
  }, [visible, lyrics, measure]);

  useEffect(() => {
    if (!visible) return;
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [visible, measure]);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const autoOffset = (() => {
    if (activeIndex < 0) return 0;
    const center = centers[activeIndex];
    if (center === undefined) return 0;
    return viewport / 2 - center;
  })();

  const minOffset = Math.min(0, viewport - innerHeight);
  const translate = Math.max(minOffset, Math.min(0, autoOffset + manual));

  // 供原生事件监听读取最新几何数据（React 的 wheel/touchmove 监听是被动的，
  // 无法 preventDefault，因此这里自己绑定非被动监听）。
  const geometry = useRef({ autoOffset, minOffset, innerHeight, viewport });
  geometry.current = { autoOffset, minOffset, innerHeight, viewport };

  const scheduleReset = useCallback(() => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      resetTimer.current = null;
      setManual(0);
    }, MANUAL_RESET_DELAY);
  }, []);

  const shift = useCallback(
    (delta: number) => {
      const { autoOffset: auto, minOffset: minimum, innerHeight: contentHeight, viewport: height } =
        geometry.current;
      if (contentHeight <= height) return;
      const lower = minimum - auto;
      const upper = -auto;
      setManual((previous) => Math.max(lower, Math.min(upper, previous + delta)));
      scheduleReset();
    },
    [scheduleReset],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (event: WheelEvent): void => {
      const { innerHeight: contentHeight, viewport: height } = geometry.current;
      if (contentHeight <= height) return;
      event.preventDefault();
      shift(-event.deltaY);
    };

    let touchY: number | null = null;
    const onTouchStart = (event: TouchEvent): void => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent): void => {
      const current = event.touches[0]?.clientY ?? null;
      if (touchY === null || current === null) return;
      const delta = current - touchY;
      touchY = current;
      if (delta !== 0) {
        event.preventDefault();
        shift(delta);
      }
    };
    const onTouchEnd = (): void => {
      touchY = null;
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);
    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [shift, status, lines.length]);

  if (status === "loading") {
    return <LoadingState text="正在加载歌词…" />;
  }

  if (status === "error") {
    return (
      <EmptyState
        icon={<Music4 size={26} />}
        title="歌词加载失败"
        description={error ?? "网络或接口暂时不可用"}
      />
    );
  }

  if (!lyrics || (lines.length === 0 && !lyrics.plain)) {
    return (
      <EmptyState
        icon={<Music4 size={26} />}
        title="这首歌暂时没有歌词"
        description="纯音乐、或接口尚未提供歌词文件。"
      />
    );
  }

  if (lines.length === 0 && lyrics.plain) {
    return (
      <div className="lyrics-scroll">
        <div className="lyrics-plain">{lyrics.plain}</div>
      </div>
    );
  }

  return (
    <div className="lyrics-scroll" ref={containerRef}>
      <div className="lyrics-inner" ref={innerRef} style={{ transform: `translateY(${translate}px)` }}>
        {lines.map((line, index) => (
          <p
            key={`${line.time}-${index}`}
            data-lyric-line
            className={`lyric-line${index === activeIndex ? " active" : ""}${
              index < activeIndex ? " past" : ""
            }`}
            onClick={() => audioEngine.seek(line.time)}
            title="点击跳到这一句"
          >
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}
