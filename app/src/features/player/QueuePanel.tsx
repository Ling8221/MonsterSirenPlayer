import { useMemo } from "react";
import { ListMusic, X } from "lucide-react";
import { EmptyState } from "@/components/State";
import { joinArtists } from "@/lib/format";
import { useAudioStore } from "@/play/audioEngine";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";

export function QueuePanel({ variant = "popup" }: { variant?: "popup" | "drawer" }) {
  const queue = usePlaybackStore((state) => state.queue);
  const currentIndex = usePlaybackStore((state) => state.index);
  const songById = useLibraryStore((state) => state.songById);
  const albumById = useLibraryStore((state) => state.albumById);
  const playing = useAudioStore((state) => state.playing);

  const rows = useMemo(
    () =>
      queue.map((id, index) => {
        const song = songById.get(id);
        const album = song?.albumId ? albumById.get(song.albumId) : undefined;
        return {
          id,
          index,
          name: song?.name ?? "未知歌曲",
          artists: song ? joinArtists(song.artists) : "",
          album: album?.name ?? "",
        };
      }),
    [queue, songById, albumById],
  );

  return (
    <div className={`queue-panel queue-panel-${variant}`}>
      <header className="queue-head">
        <span className="queue-title">
          <ListMusic size={16} />
          播放队列
        </span>
        <span className="queue-count">{queue.length} 首</span>
        {queue.length > 0 ? (
          <button
            type="button"
            className="text-btn queue-clear"
            onClick={() => usePlaybackStore.getState().clear()}
          >
            清空
          </button>
        ) : null}
      </header>

      <div className="queue-list">
        {rows.length === 0 ? (
          <EmptyState title="播放队列是空的" description="点一首歌开始播放吧。" />
        ) : (
          rows.map((row) => {
            const active = row.index === currentIndex;
            return (
              <div
                key={`${row.id}-${row.index}`}
                className={`queue-item${active ? " active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => usePlaybackStore.getState().jumpTo(row.index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") usePlaybackStore.getState().jumpTo(row.index);
                }}
              >
                <span className="queue-index">
                  {active ? (
                    <span className={`song-eq${playing ? "" : " paused"}`} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    row.index + 1
                  )}
                </span>
                <span className="queue-text">
                  <span className="queue-name" title={row.name}>
                    {row.name}
                  </span>
                  <span className="queue-sub" title={`${row.artists}${row.album ? ` · ${row.album}` : ""}`}>
                    {row.artists}
                    {row.album ? ` · ${row.album}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="icon-btn small queue-remove"
                  title="从队列移除"
                  onClick={(event) => {
                    event.stopPropagation();
                    usePlaybackStore.getState().removeAt(row.index);
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
