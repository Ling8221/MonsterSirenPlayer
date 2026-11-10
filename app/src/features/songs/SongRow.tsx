import { useRef } from "react";
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { GripVertical, MoreHorizontal, Pause, Play, X } from "lucide-react";
import type { Album, Song } from "@/api/types";
import { joinArtists } from "@/lib/format";

export const SONG_ROW_HEIGHT = 58;

interface SongRowProps {
  song: Song;
  index: number;
  album: Album | null;
  playing: boolean;
  paused: boolean;
  favorite: boolean;
  showAlbum: boolean;
  style?: CSSProperties;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onOpenAlbum: (albumId: string) => void;
  onMenu: (event: { clientX: number; clientY: number }) => void;
  onRemove?: () => void;
  reorderable?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDrop?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}

export function SongRow({
  song,
  index,
  album,
  playing,
  paused,
  favorite,
  showAlbum,
  style,
  onPlay,
  onToggleFavorite,
  onOpenAlbum,
  onMenu,
  onRemove,
  reorderable = false,
  dragging = false,
  dragOver = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SongRowProps) {
  const longPress = useRef<{ timer: number | null; x: number; y: number }>({
    timer: null,
    x: 0,
    y: 0,
  });

  const clearLongPress = (): void => {
    if (longPress.current.timer !== null) {
      window.clearTimeout(longPress.current.timer);
      longPress.current.timer = null;
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === "mouse") return;
    const { clientX: x, clientY: y } = event;
    clearLongPress();
    longPress.current.timer = window.setTimeout(() => {
      longPress.current.timer = null;
      onMenu({ clientX: x, clientY: y });
    }, 480);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (longPress.current.timer === null) return;
    const dx = Math.abs(event.clientX - longPress.current.x);
    const dy = Math.abs(event.clientY - longPress.current.y);
    if (dx > 8 || dy > 8) clearLongPress();
  };

  return (
    <div
      className={`song-row${playing ? " playing" : ""}${dragging ? " dragging" : ""}${
        dragOver ? " drag-over" : ""
      }`}
      style={{ ...style, height: SONG_ROW_HEIGHT }}
      role="button"
      tabIndex={0}
      draggable={reorderable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onPlay}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPlay();
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu({ clientX: event.clientX, clientY: event.clientY });
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
    >
      <div className="song-index">
        {reorderable ? (
          <span
            className="song-drag-handle"
            title="拖动排序"
            aria-hidden="true"
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical size={14} />
          </span>
        ) : null}
        {playing ? (
          <span className={`song-eq${paused ? " paused" : ""}`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <span className="song-index-number">{index + 1}</span>
        )}
        <span className="song-index-play" aria-hidden="true">
          {playing && !paused ? <Pause size={14} /> : <Play size={14} />}
        </span>
      </div>

      <div className="song-main">
        <span className="song-name" title={song.name}>
          {song.name}
        </span>
        {showAlbum && album ? (
          <button
            type="button"
            className="song-sub"
            title={album.name}
            onClick={(event) => {
              event.stopPropagation();
              onOpenAlbum(album.id);
            }}
          >
            {album.name}
          </button>
        ) : null}
      </div>

      <div className="song-artists" title={joinArtists(song.artists)}>
        {joinArtists(song.artists)}
      </div>

      <div className="song-actions">
        <button
          type="button"
          className={`icon-btn small${favorite ? " is-favorite" : ""}`}
          title={favorite ? "取消收藏" : "收藏"}
          aria-pressed={favorite}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={favorite ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </button>

        {onRemove ? (
          <button
            type="button"
            className="icon-btn small"
            title="从歌单移除"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <X size={16} />
          </button>
        ) : null}

        <button
          type="button"
          className="icon-btn small"
          title="更多操作"
          onClick={(event) => {
            event.stopPropagation();
            onMenu({ clientX: event.clientX, clientY: event.clientY });
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
