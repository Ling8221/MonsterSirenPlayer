import type { Album, RawAlbum, RawAlbumDetail, RawSong, Song } from "@/api/types";
import { cleanName, includesKeyword, normalizeForSearch, pickArtists } from "@/lib/format";

export interface LibrarySnapshot {
  songs: Song[];
  albums: Album[];
}

export type AlbumDetailMap = Record<string, RawAlbumDetail>;

/**
 * 把接口专辑 + 已缓存的专辑详情合并成内部模型。
 * 详情里才有 intro 与曲序，因此没有详情的专辑 songIds 为空，等按需加载后补齐。
 */
export function normalizeAlbums(raw: readonly RawAlbum[], details: AlbumDetailMap = {}): Album[] {
  const seen = new Set<string>();
  const albums: Album[] = [];

  for (const item of raw) {
    const id = String(item.cid ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const detail = details[id];
    albums.push({
      id,
      name: cleanName(item.name) || "未命名专辑",
      coverUrl: (item.coverUrl || item.coverDeUrl || detail?.coverUrl || "").trim(),
      intro: (detail?.intro ?? item.intro ?? "").trim(),
      artists: pickArtists(item.artistes, detail?.artistes),
      songIds: (detail?.songs ?? []).map((song) => String(song.cid)),
    });
  }

  return albums;
}

/** 专辑详情里出现的歌曲 → 所属专辑，用于给 /songs 补全专辑归属。 */
export function albumSongIndex(details: AlbumDetailMap): Map<string, string> {
  const index = new Map<string, string>();
  for (const [albumId, detail] of Object.entries(details)) {
    for (const song of detail.songs ?? []) {
      const id = String(song.cid ?? "").trim();
      if (id) index.set(id, albumId);
    }
  }
  return index;
}

export function normalizeSongs(raw: readonly RawSong[], details: AlbumDetailMap = {}): Song[] {
  const detailAlbum = albumSongIndex(details);
  const seen = new Set<string>();
  const songs: Song[] = [];

  const push = (id: string, name: string, artists: string[], albumId: string | null): void => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    songs.push({
      id,
      name: cleanName(name) || "未命名歌曲",
      artists,
      albumId,
    });
  };

  for (const item of raw) {
    const id = String(item.cid ?? "").trim();
    const albumId = (item.albumCid ? String(item.albumCid) : detailAlbum.get(id)) ?? null;
    push(id, item.name, pickArtists(item.artists, item.artistes), albumId);
  }

  // /songs 偶尔缺少新专辑中的曲目，用专辑详情补齐。
  const detailSongIds = Object.keys(details);
  for (const albumId of detailSongIds) {
    const detail = details[albumId];
    for (const item of detail?.songs ?? []) {
      push(String(item.cid ?? "").trim(), item.name, pickArtists(item.artistes, item.artists), albumId);
    }
  }

  return songs;
}

export interface LibraryIndexes {
  songById: Map<string, Song>;
  albumById: Map<string, Album>;
  songsByAlbum: Map<string, Song[]>;
}

export function buildIndexes(songs: readonly Song[], albums: readonly Album[]): LibraryIndexes {
  const songById = new Map(songs.map((song) => [song.id, song]));
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const songsByAlbum = new Map<string, Song[]>();

  for (const song of songs) {
    if (!song.albumId) continue;
    const bucket = songsByAlbum.get(song.albumId);
    if (bucket) bucket.push(song);
    else songsByAlbum.set(song.albumId, [song]);
  }

  return { songById, albumById, songsByAlbum };
}

export function albumOfSong(song: Song | null | undefined, albums: Map<string, Album>): Album | null {
  if (!song?.albumId) return null;
  return albums.get(song.albumId) ?? null;
}

export interface SongGroup {
  albumId: string | null;
  album: Album | null;
  songs: Song[];
}

/** 搜索结果按专辑分组；没有归属的歌曲单独一组放在最后。 */
export function groupSongsByAlbum(
  songs: readonly Song[],
  albums: Map<string, Album>,
): SongGroup[] {
  const groups = new Map<string | null, SongGroup>();

  for (const song of songs) {
    const key = song.albumId;
    const existing = groups.get(key);
    if (existing) {
      existing.songs.push(song);
      continue;
    }
    groups.set(key, {
      albumId: key,
      album: key ? (albums.get(key) ?? null) : null,
      songs: [song],
    });
  }

  const withAlbum = [...groups.values()].filter((group) => group.album !== null);
  const orphans = [...groups.values()].filter((group) => group.album === null);

  withAlbum.sort((a, b) => {
    const left = a.album?.name ?? "";
    const right = b.album?.name ?? "";
    return left.localeCompare(right, "zh-Hans-CN");
  });

  return [...withAlbum, ...orphans];
}

export interface SearchResults {
  keyword: string;
  albums: Album[];
  songs: Song[];
  groups: SongGroup[];
}

const EMPTY_RESULTS: SearchResults = { keyword: "", albums: [], songs: [], groups: [] };

export function searchLibrary(
  songs: readonly Song[],
  albums: readonly Album[],
  albumIndex: Map<string, Album>,
  rawKeyword: string,
): SearchResults {
  const keyword = normalizeForSearch(rawKeyword);
  if (!keyword) return EMPTY_RESULTS;

  const matchedAlbums = albums.filter((album) => {
    const artwork = album.artists.join(" ");
    return includesKeyword(album.name, keyword) || includesKeyword(artwork, keyword);
  });

  const matchedSongs = songs.filter((song) => {
    if (includesKeyword(song.name, keyword)) return true;
    if (song.artists.some((artist) => includesKeyword(artist, keyword))) return true;
    const album = song.albumId ? albumIndex.get(song.albumId) : null;
    return album ? includesKeyword(album.name, keyword) : false;
  });

  return {
    keyword: rawKeyword.trim(),
    albums: matchedAlbums,
    songs: matchedSongs,
    groups: groupSongsByAlbum(matchedSongs, albumIndex),
  };
}

/** 首页「最新专辑」：接口按发布时间倒序返回，直接取前 n 张。 */
export function latestAlbums(albums: readonly Album[], count: number): Album[] {
  return albums.slice(0, count);
}

/** 单曲所属专辑名，用于播放器与队列展示。 */
export function albumNameOf(
  song: Song | null | undefined,
  albumIndex: Map<string, Album>,
): string | null {
  if (!song?.albumId) return null;
  return albumIndex.get(song.albumId)?.name ?? null;
}

/** 判断一组歌曲里有多少比例带专辑归属，用于决定是否需要批量拉专辑详情。 */
export function albumCoverage(songs: readonly Song[]): number {
  if (songs.length === 0) return 1;
  const owned = songs.filter((song) => song.albumId !== null).length;
  return owned / songs.length;
}
