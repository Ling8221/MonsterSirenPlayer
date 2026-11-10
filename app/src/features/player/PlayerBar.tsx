import { useEffect, useRef } from "react";
import { ListMusic } from "lucide-react";
import { Cover } from "@/components/Cover";
import { joinArtists } from "@/lib/format";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useUiStore } from "@/store/useUiStore";
import { ProgressBar } from "./ProgressBar";
import { QueuePanel } from "./QueuePanel";
import { TransportControls } from "./TransportControls";
import { VolumeControl } from "./VolumeControl";

export function PlayerBar() {
  const current = usePlaybackStore((state) => state.current);
  const loading = usePlaybackStore((state) => state.loading);
  const album = useLibraryStore((state) =>
    current?.albumId ? state.albumById.get(current.albumId) : undefined,
  );
  const openNowPlaying = useUiStore((state) => state.openNowPlaying);
  const queueOpen = useUiStore((state) => state.queueOpen);
  const toggleQueue = useUiStore((state) => state.toggleQueue);
  const closeQueue = useUiStore((state) => state.closeQueue);

  const queueWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!queueOpen) return;
    const handlePointerDown = (event: PointerEvent): void => {
      if (queueWrapRef.current?.contains(event.target as Node)) return;
      closeQueue();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [queueOpen, closeQueue]);

  return (
    <footer className="player-bar">
      <div className="player-track">
        <button
          type="button"
          className="player-cover-btn"
          onClick={() => (current ? openNowPlaying() : undefined)}
          title={current ? "展开正在播放" : "未在播放"}
          aria-label="展开正在播放"
        >
          <Cover src={album?.coverUrl} name={current?.name ?? "塞壬唱片"} />
          <span className="player-cover-hint" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m18 15-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        <div className="player-track-text">
          <span className={`player-title${loading ? " is-loading" : ""}`}>
            {current?.name ?? "未在播放"}
          </span>
          <span className="player-artist">
            {current
              ? [joinArtists(current.artists), album?.name].filter(Boolean).join(" · ")
              : "选择一首歌曲开始"}
          </span>
        </div>
      </div>

      <div className="player-center">
        <TransportControls />
        <ProgressBar compact />
      </div>

      <div className="player-extra">
        <div className="queue-wrap" ref={queueWrapRef}>
          <button
            type="button"
            className={`icon-btn${queueOpen ? " is-active" : ""}`}
            title="播放队列"
            aria-label="播放队列"
            aria-expanded={queueOpen}
            onClick={toggleQueue}
          >
            <ListMusic size={18} />
          </button>
          {queueOpen ? (
            <div className="queue-popover">
              <QueuePanel variant="popup" />
            </div>
          ) : null}
        </div>

        <VolumeControl />
      </div>
    </footer>
  );
}
