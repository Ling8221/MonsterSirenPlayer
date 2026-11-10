import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";
import { AlbumCard } from "@/features/albums/AlbumCard";
import { EmptyState, LoadingState } from "@/components/State";
import { includesKeyword } from "@/lib/format";

export function AlbumsView() {
  const albums = useLibraryStore((state) => state.albums);
  const status = useLibraryStore((state) => state.status);
  const navigate = useUiStore((state) => state.navigate);
  const [filter, setFilter] = useState("");

  const shown = useMemo(() => {
    const keyword = filter.trim();
    if (!keyword) return albums;
    return albums.filter(
      (album) =>
        includesKeyword(album.name, keyword) ||
        album.artists.some((artist) => includesKeyword(artist, keyword)),
    );
  }, [albums, filter]);

  if (status === "loading" && albums.length === 0) {
    return <LoadingState text="正在加载专辑…" />;
  }

  return (
    <div className="view">
      <header className="view-header">
        <div className="view-title">
          <h1>全部专辑</h1>
          <span className="view-count">{albums.length} 张</span>
        </div>
        <label className="filter-input">
          <Search size={15} />
          <input
            value={filter}
            placeholder="筛选专辑或艺人"
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
      </header>

      <div className="view-scroll">
        {shown.length === 0 ? (
          <EmptyState title="没有找到匹配的专辑" description="换个关键词试试" />
        ) : (
          <div className="album-grid">
            {shown.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onOpen={() => navigate({ name: "album", id: album.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
