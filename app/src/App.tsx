import { useEffect } from "react";
import { TitleBar } from "@/features/titlebar/TitleBar";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { HomeView } from "@/features/home/HomeView";
import { SearchView } from "@/features/search/SearchView";
import { SongsView } from "@/features/songs/SongsView";
import { AlbumsView } from "@/features/albums/AlbumsView";
import { AlbumDetailView } from "@/features/albums/AlbumDetailView";
import { FavoritesView } from "@/features/favorites/FavoritesView";
import { PlaylistsView } from "@/features/playlists/PlaylistsView";
import { PlaylistDetailView } from "@/features/playlists/PlaylistDetailView";
import { SettingsView } from "@/features/settings/SettingsView";
import { PlayerBar } from "@/features/player/PlayerBar";
import { NowPlaying } from "@/features/player/NowPlaying";
import { PlaybackRuntime } from "@/features/player/PlaybackRuntime";
import { SongContextMenu } from "@/features/contextmenu/SongContextMenu";
import { DialogHost } from "@/features/playlists/DialogHost";
import { Toasts } from "@/components/Toasts";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTrayEvents } from "@/hooks/useTrayEvents";
import { useWindowPersistence } from "@/hooks/useWindowPersistence";
import { applyDemoParams } from "@/dev/demoParams";
import { waitForHydration } from "@/lib/hydration";
import { migrateStorageLayout } from "@/lib/storage";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { usePlaylistsStore } from "@/store/usePlaylistsStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useUiStore } from "@/store/useUiStore";

function ViewHost() {
  const view = useUiStore((state) => state.view);

  switch (view.name) {
    case "home":
      return <HomeView />;
    case "search":
      return <SearchView />;
    case "songs":
      return <SongsView />;
    case "albums":
      return <AlbumsView />;
    case "album":
      return <AlbumDetailView albumId={view.id} />;
    case "favorites":
      return <FavoritesView />;
    case "playlists":
      return <PlaylistsView />;
    case "playlist":
      return <PlaylistDetailView playlistId={view.id} />;
    case "settings":
      return <SettingsView />;
    default:
      return <HomeView />;
  }
}

export default function App() {
  useKeyboardShortcuts();
  useTrayEvents();
  useWindowPersistence();

  useEffect(() => {
    // 桌面端不需要浏览器自带的右键菜单（输入框除外）。
    const handleContextMenu = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea")) return;
      event.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await Promise.all([
        waitForHydration(useSettingsStore),
        waitForHydration(useFavoritesStore),
        waitForHydration(usePlaylistsStore),
      ]);
      if (cancelled) return;
      await migrateStorageLayout();
      if (cancelled) return;
      await useLibraryStore.getState().load();
      if (cancelled) return;
      await usePlaybackStore.getState().hydrate();
      if (cancelled) return;
      await applyDemoParams();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <PlaybackRuntime />
      <TitleBar />

      <div className="app-body">
        <Sidebar />
        <main className="content">
          <ViewHost />
        </main>
      </div>

      <PlayerBar />
      <NowPlaying />
      <SongContextMenu />
      <DialogHost />
      <Toasts />
    </div>
  );
}
