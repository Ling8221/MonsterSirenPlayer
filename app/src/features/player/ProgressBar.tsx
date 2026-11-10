import { useState } from "react";
import type { CSSProperties } from "react";
import { audioEngine, useAudioStore } from "@/play/audioEngine";
import { formatTime } from "@/lib/format";

export function ProgressBar({ compact = false }: { compact?: boolean }) {
  const time = useAudioStore((state) => state.time);
  const duration = useAudioStore((state) => state.duration);
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  const ratio = duration > 0 ? Math.min(Math.max(time / duration, 0), 1) : 0;
  const shownRatio = dragRatio ?? ratio;
  const shownTime = dragRatio !== null ? dragRatio * duration : time;

  const seek = (target: number): void => {
    if (duration <= 0) return;
    audioEngine.seek(target * duration);
  };

  return (
    <div className={`progress${compact ? " progress-compact" : ""}`}>
      <span className="progress-time">{formatTime(shownTime)}</span>
      <input
        className="progress-range"
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={shownRatio}
        aria-label="播放进度"
        style={{ "--fill": `${shownRatio * 100}%` } as CSSProperties}
        onPointerDown={() => setDragRatio(ratio)}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (dragRatio !== null) {
            setDragRatio(value);
            return;
          }
          seek(value);
        }}
        onPointerUp={() => {
          if (dragRatio !== null) {
            seek(dragRatio);
            setDragRatio(null);
          }
        }}
        onPointerCancel={() => setDragRatio(null)}
        onBlur={() => {
          if (dragRatio !== null) {
            seek(dragRatio);
            setDragRatio(null);
          }
        }}
      />
      <span className="progress-time">{formatTime(duration)}</span>
    </div>
  );
}
