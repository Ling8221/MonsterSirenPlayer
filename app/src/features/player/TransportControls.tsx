import {
  Heart,
  Music4,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useAudioStore } from "@/play/audioEngine";
import { PLAY_MODE_LABEL } from "@/lib/queue";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { Spinner } from "@/components/State";

const MODE_ICONS = {
  single: Music4,
  "list-loop": Repeat,
  "single-loop": Repeat1,
  shuffle: Shuffle,
} as const;

export function TransportControls({ variant = "bar" }: { variant?: "bar" | "immersive" }) {
  const mode = usePlaybackStore((state) => state.mode);
  const playing = useAudioStore((state) => state.playing);
  const buffering = useAudioStore((state) => state.buffering);
  const loading = usePlaybackStore((state) => state.loading);
  const currentId = usePlaybackStore((state) => state.current?.id ?? null);
  const favorite = useFavoritesStore((state) =>
    currentId ? state.ids.includes(currentId) : false,
  );

  const ModeIcon = MODE_ICONS[mode];

  return (
    <div className={`transport transport-${variant}`}>
      <button
        type="button"
        className="icon-btn"
        title={PLAY_MODE_LABEL[mode]}
        aria-label={PLAY_MODE_LABEL[mode]}
        onClick={() => usePlaybackStore.getState().cycleMode()}
      >
        <ModeIcon size={18} />
      </button>

      <button
        type="button"
        className="icon-btn"
        title="上一首"
        aria-label="上一首"
        onClick={() => usePlaybackStore.getState().previous()}
      >
        <SkipBack size={20} />
      </button>

      <button
        type="button"
        className="play-toggle"
        title={playing ? "暂停" : "播放"}
        aria-label={playing ? "暂停" : "播放"}
        onClick={() => usePlaybackStore.getState().toggle()}
      >
        {loading || (buffering && playing) ? (
          <Spinner size={20} />
        ) : playing ? (
          <Pause size={22} fill="currentColor" strokeWidth={0} />
        ) : (
          <Play size={22} fill="currentColor" strokeWidth={0} className="play-icon" />
        )}
      </button>

      <button
        type="button"
        className="icon-btn"
        title="下一首"
        aria-label="下一首"
        onClick={() => usePlaybackStore.getState().next()}
      >
        <SkipForward size={20} />
      </button>

      <button
        type="button"
        className={`icon-btn${favorite ? " is-favorite" : ""}`}
        title={favorite ? "取消收藏" : "收藏"}
        aria-label={favorite ? "取消收藏" : "收藏"}
        aria-pressed={favorite}
        disabled={!currentId}
        onClick={() => {
          if (currentId) useFavoritesStore.getState().toggle(currentId);
        }}
      >
        <Heart size={18} fill={favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
