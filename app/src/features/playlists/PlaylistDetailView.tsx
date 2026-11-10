import { useMemo } from "react";
import { ArrowLeft, Pencil, Play, Trash2 } from "lucide-react";
import type { Song } from "@/api/types";
import { EmptyState } from "@/components/State";
import { PlaylistCover } from "@/features/playlists/PlaylistCover";
import { SongList } from "@/features/songs/SongList";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { usePlaylistsStore } from "@/store/usePlaylistsStore";
import { useUiStore } from "@/store/useUiStore";

export function PlaylistDetailView({ playlistId }: { playlistId: string }) {
  const playlist = usePlaylistsStore((state) => state.items.find((item) => item.id === playlistId));
  const songById = useLibraryStore((state) => state.songById);
  const albumById = useLibraryStore((state) => state.albumById);
  const back = useUiStore((state) => state.back);
  const openDialog = useUiStore((state) => state.openDialog);

  const songs = useMemo<Song[]>(() => {
    if (!playlist) return [];
    return playlist.songIds
      .map((id) => songById.get(id))
      .filter((song): song is Song => Boolean(song));
  }, [playlist, songById]);

  if (!playlist) {
    return (
      <div className="view">
        <EmptyState
          title="歌单不存在"
          description="它可能已经被删除了"
          action={
            <button type="button" className="btn" onClick={() => back()}>
              返回
            </button>
          }
        />
      </div>
    );
  }

  const playAll = (): void => {
    if (songs.length === 0) return;
    usePlaybackStore.getState().playList(
      songs.map((song) => song.id),
      songs[0]!.id,
    );
  };

  return (
    <div className="view view-fill">
      <div className="detail-header">
        <button type="button" className="icon-btn detail-back" onClick={() => back()} title="返回">
          <ArrowLeft size={18} />
        </button>

        <PlaylistCover
          songIds={playlist.songIds}
          songIndex={songById}
          albumIndex={albumById}
          className="detail-cover"
        />

        <div className="detail-meta">
          <p className="detail-eyebrow">歌单</p>
          <h1>{playlist.name}</h1>
          <p className="detail-artists">{playlist.songIds.length} 首歌曲</p>
          <div className="detail-actions">
            <button type="button" className="btn btn-primary" onClick={playAll} disabled={songs.length === 0}>
              <Play size={16} fill="currentColor" strokeWidth={0} />
              播放全部
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => openDialog({ type: "rename-playlist", playlistId: playlist.id })}
            >
              <Pencil size={15} />
              重命名
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={() => openDialog({ type: "delete-playlist", playlistId: playlist.id })}
            >
              <Trash2 size={15} />
              删除
            </button>
          </div>
        </div>
      </div>

      <div className="detail-body">
        <SongList
          songs={songs}
          albumIndex={albumById}
          showAlbum
          onRemove={(songId) => usePlaylistsStore.getState().removeSong(playlist.id, songId)}
          onReorder={(from, to) => {
            const fromSong = songs[from];
            const toSong = songs[to];
            if (!fromSong || !toSong) return;
            const fromIndex = playlist.songIds.indexOf(fromSong.id);
            const toIndex = playlist.songIds.indexOf(toSong.id);
            if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
            usePlaylistsStore.getState().reorder(playlist.id, fromIndex, toIndex);
          }}
          emptyTitle="歌单还是空的"
          emptyDescription="在歌曲上右键或点「⋯」，选择「添加到歌单」。"
        />
      </div>
    </div>
  );
}
