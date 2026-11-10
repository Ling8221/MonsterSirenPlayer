import { Plus } from "lucide-react";
import { EmptyState } from "@/components/State";
import { PlaylistCover } from "@/features/playlists/PlaylistCover";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaylistsStore } from "@/store/usePlaylistsStore";
import { useUiStore } from "@/store/useUiStore";

export function PlaylistsView() {
  const playlists = usePlaylistsStore((state) => state.items);
  const songById = useLibraryStore((state) => state.songById);
  const albumById = useLibraryStore((state) => state.albumById);
  const navigate = useUiStore((state) => state.navigate);
  const openDialog = useUiStore((state) => state.openDialog);

  return (
    <div className="view">
      <header className="view-header">
        <div className="view-title">
          <h1>我的歌单</h1>
          <span className="view-count">{playlists.length} 个</span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openDialog({ type: "create-playlist", songIds: [] })}
        >
          <Plus size={16} />
          新建歌单
        </button>
      </header>

      <div className="view-scroll">
        {playlists.length === 0 ? (
          <EmptyState
            title="还没有歌单"
            description="把喜欢的歌曲整理成歌单，之后随时一起播放。"
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openDialog({ type: "create-playlist", songIds: [] })}
              >
                新建第一个歌单
              </button>
            }
          />
        ) : (
          <div className="playlist-grid">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="playlist-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate({ name: "playlist", id: playlist.id })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate({ name: "playlist", id: playlist.id });
                  }
                }}
              >
                <PlaylistCover
                  songIds={playlist.songIds}
                  songIndex={songById}
                  albumIndex={albumById}
                />
                <div className="playlist-card-meta">
                  <span className="playlist-card-name" title={playlist.name}>
                    {playlist.name}
                  </span>
                  <span className="playlist-card-count">{playlist.songIds.length} 首</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
