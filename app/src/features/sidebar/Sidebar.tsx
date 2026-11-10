import { Heart, House, ListMusic, Music, Plus, Search, Settings, Disc3 } from "lucide-react";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaylistsStore } from "@/store/usePlaylistsStore";
import { useUiStore, type ViewSpec } from "@/store/useUiStore";

interface NavItem {
  view: ViewSpec;
  label: string;
  icon: typeof House;
}

const NAV_ITEMS: NavItem[] = [
  { view: { name: "home" }, label: "首页", icon: House },
  { view: { name: "search" }, label: "搜索", icon: Search },
  { view: { name: "songs" }, label: "歌曲", icon: Music },
  { view: { name: "albums" }, label: "专辑", icon: Disc3 },
  { view: { name: "settings" }, label: "设置", icon: Settings },
];

export function Sidebar() {
  const view = useUiStore((state) => state.view);
  const navigate = useUiStore((state) => state.navigate);
  const openDialog = useUiStore((state) => state.openDialog);
  const playlists = usePlaylistsStore((state) => state.items);
  const favoriteCount = useFavoritesStore((state) => state.ids.length);
  const detailProgress = useLibraryStore((state) => state.detailProgress);

  const isActive = (name: ViewSpec["name"]): boolean => {
    if (view.name === name) return true;
    if (name === "albums" && view.name === "album") return true;
    return false;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="2.4" />
            <path d="M12 9.6V6.2M12 14.4v3.4" strokeLinecap="round" />
          </svg>
        </span>
        <span className="sidebar-logo-text">塞壬唱片</span>
      </div>

      <nav className="sidebar-nav" aria-label="主导航">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className={`sidebar-link${isActive(item.view.name) ? " active" : ""}`}
              onClick={() => navigate(item.view)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <span>我的歌单</span>
          <button
            type="button"
            className="icon-btn small"
            title="新建歌单"
            onClick={() => openDialog({ type: "create-playlist", songIds: [] })}
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="sidebar-playlists">
          <button
            type="button"
            className={`sidebar-playlist pinned${view.name === "favorites" ? " active" : ""}`}
            onClick={() => navigate({ name: "favorites" })}
            title="我的收藏"
          >
            <Heart size={15} />
            <span className="sidebar-playlist-name">我的收藏</span>
            <span className="sidebar-playlist-count">{favoriteCount}</span>
          </button>

          {playlists.length === 0 ? (
            <p className="sidebar-empty">还没有歌单，点右上角 + 新建</p>
          ) : (
            playlists.map((playlist) => {
              const active = view.name === "playlist" && view.id === playlist.id;
              return (
                <button
                  key={playlist.id}
                  type="button"
                  className={`sidebar-playlist${active ? " active" : ""}`}
                  onClick={() => navigate({ name: "playlist", id: playlist.id })}
                  title={playlist.name}
                >
                  <ListMusic size={15} />
                  <span className="sidebar-playlist-name">{playlist.name}</span>
                  <span className="sidebar-playlist-count">{playlist.songIds.length}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="sidebar-foot">
        <button type="button" className="sidebar-foot-link" onClick={() => navigate({ name: "playlists" })}>
          管理歌单
        </button>
        {detailProgress.active ? (
          <span className="sidebar-progress">
            索引专辑 {detailProgress.loaded}/{detailProgress.total}
          </span>
        ) : null}
      </div>
    </aside>
  );
}
