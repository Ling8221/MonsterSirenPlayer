import { audioEngine } from "@/play/audioEngine";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useUiStore } from "@/store/useUiStore";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * 仅开发 / 演示模式生效的 URL 参数，方便截图与手动检查界面：
 *
 *   ?mock=1&view=songs            指定初始页面
 *   ?mock=1&view=album&album=6667 打开指定专辑
 *   ?mock=1&np=1&play=1&t=12      打开沉浸式播放并跳到第 12 秒
 */
export async function applyDemoParams(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const dev = import.meta.env.DEV;
  if (!dev && !params.has("mock")) return;

  const ui = useUiStore.getState();

  const view = params.get("view");
  if (view === "home") ui.navigate({ name: "home" });
  else if (view === "search") ui.navigate({ name: "search" });
  else if (view === "songs") ui.navigate({ name: "songs" });
  else if (view === "albums") ui.navigate({ name: "albums" });
  else if (view === "favorites") ui.navigate({ name: "favorites" });
  else if (view === "playlists") ui.navigate({ name: "playlists" });
  else if (view === "album") {
    const albumId = params.get("album");
    if (albumId) ui.navigate({ name: "album", id: albumId });
  } else if (view === "playlist") {
    const playlistId = params.get("playlist");
    if (playlistId) ui.navigate({ name: "playlist", id: playlistId });
  }

  const keyword = params.get("q");
  if (keyword) ui.setSearchKeyword(keyword);

  if (params.get("np") !== "1") return;

  const playback = usePlaybackStore.getState();
  const songs = useLibraryStore.getState().songs;
  if (!playback.current && songs.length > 0) {
    const seed = songs.slice(0, 25).map((song) => song.id);
    playback.playList(seed, seed[0]!);
  }
  useUiStore.setState({ nowPlayingOpen: true });

  if (params.get("play") === "1") {
    await delay(900);
    audioEngine.play();
    const target = Number(params.get("t") ?? "0");
    if (Number.isFinite(target) && target > 0) {
      await delay(500);
      audioEngine.seek(target);
    }
  }
}
