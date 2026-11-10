import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SongList } from "@/features/songs/SongList";
import { LoadingState } from "@/components/State";
import { includesKeyword } from "@/lib/format";
import { useLibraryStore } from "@/store/useLibraryStore";

export function SongsView() {
  const songs = useLibraryStore((state) => state.songs);
  const albumById = useLibraryStore((state) => state.albumById);
  const status = useLibraryStore((state) => state.status);
  const [filter, setFilter] = useState("");

  const shown = useMemo(() => {
    const keyword = filter.trim();
    if (!keyword) return songs;
    return songs.filter((song) => {
      if (includesKeyword(song.name, keyword)) return true;
      if (song.artists.some((artist) => includesKeyword(artist, keyword))) return true;
      const album = song.albumId ? albumById.get(song.albumId) : null;
      return album ? includesKeyword(album.name, keyword) : false;
    });
  }, [songs, albumById, filter]);

  if (status === "loading" && songs.length === 0) {
    return <LoadingState text="正在加载歌曲…" />;
  }

  return (
    <div className="view view-fill">
      <header className="view-header">
        <div className="view-title">
          <h1>全部歌曲</h1>
          <span className="view-count">
            {filter.trim() ? `${shown.length} / ${songs.length} 首` : `${songs.length} 首`}
          </span>
        </div>
        <label className="filter-input">
          <Search size={15} />
          <input
            value={filter}
            placeholder="筛选歌曲、歌手或专辑"
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
      </header>

      <div className="detail-body">
        <SongList songs={shown} albumIndex={albumById} showAlbum emptyTitle="没有匹配的歌曲" />
      </div>
    </div>
  );
}
