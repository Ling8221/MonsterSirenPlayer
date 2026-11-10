import { useMemo } from "react";
import { Heart, Play } from "lucide-react";
import type { Song } from "@/api/types";
import { EmptyState, LoadingState } from "@/components/State";
import { PlaylistCover } from "@/features/playlists/PlaylistCover";
import { SongList } from "@/features/songs/SongList";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";

export function FavoritesView() {
  const favoriteIds = useFavoritesStore((state) => state.ids);
  const songById = useLibraryStore((state) => state.songById);
  const albumById = useLibraryStore((state) => state.albumById);
  const status = useLibraryStore((state) => state.status);

  const songs = useMemo<Song[]>(
    () =>
      favoriteIds
        .map((id) => songById.get(id))
        .filter((song): song is Song => Boolean(song)),
    [favoriteIds, songById],
  );

  if (status === "loading" && songs.length === 0 && favoriteIds.length > 0) {
    return <LoadingState text="正在加载收藏…" />;
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
        <PlaylistCover
          songIds={favoriteIds}
          songIndex={songById}
          albumIndex={albumById}
          className="detail-cover"
        />

        <div className="detail-meta">
          <p className="detail-eyebrow">收藏</p>
          <h1>我的收藏</h1>
          <p className="detail-artists">{songs.length} 首歌曲</p>
          <div className="detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={playAll}
              disabled={songs.length === 0}
            >
              <Play size={16} fill="currentColor" strokeWidth={0} />
              播放全部
            </button>
          </div>
        </div>
      </div>

      <div className="detail-body">
        {songs.length === 0 ? (
          <EmptyState
            icon={<Heart size={26} />}
            title="还没有收藏的歌曲"
            description="在歌曲列表里点一下心形图标，就能把喜欢的歌收进这里。"
          />
        ) : (
          <SongList
            songs={songs}
            albumIndex={albumById}
            showAlbum
            onReorder={(from, to) => {
              const fromSong = songs[from];
              const toSong = songs[to];
              if (!fromSong || !toSong) return;
              const fromIndex = favoriteIds.indexOf(fromSong.id);
              const toIndex = favoriteIds.indexOf(toSong.id);
              if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
              useFavoritesStore.getState().reorder(fromIndex, toIndex);
            }}
          />
        )}
      </div>
    </div>
  );
}
