import type { RawAlbum, RawSong, RawSongDetail } from "@/api/types";
import type { AlbumDetailMap } from "@/data/library";

/**
 * 离线演示数据。
 *
 * 打开 `?mock=1` 时使用 public/mock/library.json，
 * 便于在没有网络（或不便连接线上接口）时检查界面与交互。
 */
export interface MockLibrary {
  songs: RawSong[];
  albums: RawAlbum[];
  details: AlbumDetailMap;
}

const MOCK_AUDIO_URL = "/mock/silence.wav";
const MOCK_LYRIC_URL = "/mock/lyrics/demo.lrc";

export function isMockMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("mock") === "1";
  } catch {
    return false;
  }
}

let mockPromise: Promise<MockLibrary> | null = null;

/** 演示 JSON 里的 songs 可以留空，这里从专辑详情自动摊平，避免重复维护。 */
function flattenDetails(details: AlbumDetailMap): RawSong[] {
  const songs: RawSong[] = [];
  for (const [albumId, detail] of Object.entries(details)) {
    for (const song of detail.songs ?? []) {
      songs.push({
        cid: String(song.cid),
        name: song.name,
        albumCid: albumId,
        artists: song.artistes ?? detail.artistes ?? [],
      });
    }
  }
  return songs;
}

export function loadMockLibrary(): Promise<MockLibrary> {
  if (!mockPromise) {
    mockPromise = fetch("/mock/library.json")
      .then(async (response) => {
        if (!response.ok) throw new Error(`演示数据加载失败（HTTP ${response.status}）`);
        const library = (await response.json()) as MockLibrary;
        if (!library.songs || library.songs.length === 0) {
          library.songs = flattenDetails(library.details ?? {});
        }
        return library;
      })
      .catch((error) => {
        mockPromise = null;
        throw error;
      });
  }
  return mockPromise;
}

/** 演示模式下把歌曲详情指向本地静音音频与示例歌词。 */
export async function mockSongDetail(cid: string): Promise<RawSongDetail | null> {
  const library = await loadMockLibrary();
  const song = library.songs.find((item) => String(item.cid) === cid);
  if (!song) return null;

  const albumId = song.albumCid ? String(song.albumCid) : null;
  const album = albumId ? library.albums.find((item) => String(item.cid) === albumId) : null;

  return {
    cid,
    name: song.name,
    albumCid: albumId,
    sourceUrl: MOCK_AUDIO_URL,
    lyricUrl: MOCK_LYRIC_URL,
    artists: album?.artistes ?? song.artists ?? ["塞壬唱片-MSR"],
  };
}

export function isMockAsset(url: string): boolean {
  return url.startsWith("/mock/");
}

export { MOCK_AUDIO_URL, MOCK_LYRIC_URL };
