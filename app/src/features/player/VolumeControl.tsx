import { useEffect, useState } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { usePlaybackStore } from "@/store/usePlaybackStore";

export function VolumeControl() {
  const volume = usePlaybackStore((state) => state.volume);
  const muted = usePlaybackStore((state) => state.muted);
  const setVolume = usePlaybackStore((state) => state.setVolume);
  const toggleMute = usePlaybackStore((state) => state.toggleMute);

  const [dragging, setDragging] = useState(false);
  const effective = muted ? 0 : volume;
  const percent = Math.round(effective * 100);
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  useEffect(() => {
    if (!dragging) return;
    const stop = (): void => setDragging(false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
    };
  }, [dragging]);

  return (
    <div className="volume-control">
      <button
        type="button"
        className="icon-btn"
        title={muted || volume === 0 ? "取消静音" : "静音"}
        onClick={toggleMute}
      >
        <Icon size={18} />
      </button>

      <div className="volume-slider-wrap">
        <input
          className="volume-range"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={effective}
          aria-label="音量"
          title={`音量 ${percent}%`}
          style={{ "--fill": `${effective * 100}%` } as React.CSSProperties}
          onPointerDown={() => setDragging(true)}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
        {dragging ? (
          <span
            className="volume-tooltip"
            style={{ left: `clamp(16px, ${effective * 100}%, calc(100% - 16px))` }}
          >
            {percent}%
          </span>
        ) : null}
      </div>
    </div>
  );
}
