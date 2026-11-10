import { useMemo, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import type { Album, Song } from "@/api/types";
import { useAudioStore } from "@/play/audioEngine";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useMenuStore } from "@/store/useMenuStore";
import { useUiStore } from "@/store/useUiStore";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { SONG_ROW_HEIGHT, SongRow } from "./SongRow";
import { EmptyState } from "@/components/State";

interface SongListProps {
  songs: Song[];
  albumIndex: Map<string, Album>;
  showAlbum?: boolean;
  onRemove?: (songId: string) => void;
  onReorder?: (from: number, to: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function SongList({
  songs,
  albumIndex,
  showAlbum = false,
  onRemove,
  onReorder,
  emptyTitle = "这里还没有歌曲",
  emptyDescription,
}: SongListProps) {
  const { ref, start, end } = useVirtualRows(songs.length, SONG_ROW_HEIGHT);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const favoriteIds = useFavoritesStore((state) => state.ids);
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const currentId = usePlaybackStore((state) => state.current?.id ?? null);
  const isAudioPlaying = useAudioStore((state) => state.playing);
  const openMenu = useMenuStore((state) => state.open);
  const navigate = useUiStore((state) => state.navigate);

  const ids = useMemo(() => songs.map((song) => song.id), [songs]);

  const handleDragStart = (index: number, event: ReactDragEvent<HTMLDivElement>): void => {
    if (!onReorder) return;
    const target = event.target as HTMLElement;
    if (!target.closest(".song-drag-handle")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    setDragIndex(index);
  };

  const handleDragOver = (index: number, event: ReactDragEvent<HTMLDivElement>): void => {
    if (dragIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDrop = (index: number, event: ReactDragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const from = Number(event.dataTransfer.getData("text/plain"));
    setDragIndex(null);
    setOverIndex(null);
    if (Number.isInteger(from) && from >= 0 && from !== index) onReorder?.(from, index);
  };

  const clearDrag = (): void => {
    setDragIndex(null);
    setOverIndex(null);
  };

  if (songs.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const visible = songs.slice(start, end);

  return (
    <div className="song-list">
      <div className="song-list-head" aria-hidden="true">
        <span className="col-index">#</span>
        <span className="col-main">歌曲</span>
        <span className="col-artists">歌手</span>
        <span className="col-actions" />
      </div>

      <div className="song-list-scroll" ref={ref}>
        <div className="song-list-inner" style={{ height: songs.length * SONG_ROW_HEIGHT }}>
          {visible.map((song, offset) => {
            const index = start + offset;
            const isCurrent = song.id === currentId;
            return (
              <SongRow
                key={song.id}
                song={song}
                index={index}
                album={song.albumId ? (albumIndex.get(song.albumId) ?? null) : null}
                playing={isCurrent}
                paused={!isAudioPlaying}
                favorite={favorites.has(song.id)}
                showAlbum={showAlbum}
                style={{ transform: `translateY(${index * SONG_ROW_HEIGHT}px)` }}
                onPlay={() => usePlaybackStore.getState().playList(ids, song.id)}
                onToggleFavorite={() => useFavoritesStore.getState().toggle(song.id)}
                onOpenAlbum={(albumId) => navigate({ name: "album", id: albumId })}
                onMenu={({ clientX, clientY }) => openMenu(song.id, clientX, clientY)}
                onRemove={onRemove ? () => onRemove(song.id) : undefined}
                reorderable={Boolean(onReorder)}
                dragging={dragIndex === index}
                dragOver={overIndex === index && dragIndex !== index}
                onDragStart={(event) => handleDragStart(index, event)}
                onDragOver={(event) => handleDragOver(index, event)}
                onDrop={(event) => handleDrop(index, event)}
                onDragEnd={clearDrag}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
