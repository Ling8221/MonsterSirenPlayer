import { create } from "zustand";
import { fetchAlbumDetail, fetchAlbumList, fetchSongList } from "@/api/client";
import type { Album, RawAlbum, RawSong, Song } from "@/api/types";
import {
  albumCoverage,
  buildIndexes,
  normalizeAlbums,
  normalizeSongs,
  type AlbumDetailMap,
  type LibraryIndexes,
} from "@/data/library";
import { isMockMode, loadMockLibrary } from "@/data/mock";
import { logInfo, logWarn } from "@/lib/logger";
import { readJson, writeJson } from "@/lib/storage";

const CACHE_KEY = "cache/library";
const LEGACY_CACHE_KEY = "library-cache";
const CACHE_VERSION = 2;
const DETAILS_TTL = 7 * 24 * 60 * 60 * 1000;
const DETAIL_CONCURRENCY = 6;
/** 低于这个专辑归属比例时，批量补全专辑详情（否则按需加载即可）。 */
const DETAIL_COVERAGE_THRESHOLD = 0.75;

interface LibraryCache {
  version: number;
  fetchedAt: number;
  detailsFetchedAt: number;
  rawSongs: RawSong[];
  rawAlbums: RawAlbum[];
  albumDetails: AlbumDetailMap;
}

export type LibraryStatus = "idle" | "loading" | "ready" | "error";

export interface DetailProgress {
  active: boolean;
  loaded: number;
  total: number;
}

interface LibraryState extends LibraryIndexes {
  status: LibraryStatus;
  error: string | null;
  songs: Song[];
  albums: Album[];
  details: AlbumDetailMap;
  detailProgress: DetailProgress;
  /** 数据是否来自本地缓存（用于离线提示）。 */
  fromCache: boolean;
  load: (options?: { force?: boolean }) => Promise<void>;
  retry: () => Promise<void>;
  ensureAlbumDetail: (albumId: string) => Promise<boolean>;
}

interface LibraryRawData {
  rawSongs: RawSong[];
  rawAlbums: RawAlbum[];
  details: AlbumDetailMap;
  fetchedAt: number;
  detailsFetchedAt: number;
}

let loadPromise: Promise<void> | null = null;
let cacheTimer: number | null = null;
let bulkRunning = false;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function applySnapshot(
  rawSongs: RawSong[],
  rawAlbums: RawAlbum[],
  details: AlbumDetailMap,
): {
  songs: Song[];
  albums: Album[];
  songById: Map<string, Song>;
  albumById: Map<string, Album>;
  songsByAlbum: Map<string, Song[]>;
} {
  const songs = normalizeSongs(rawSongs, details);
  const albums = normalizeAlbums(rawAlbums, details);
  const indexes = buildIndexes(songs, albums);
  return { songs, albums, ...indexes };
}

function scheduleCacheWrite(raw: LibraryRawData): void {
  if (cacheTimer !== null) window.clearTimeout(cacheTimer);
  cacheTimer = window.setTimeout(() => {
    cacheTimer = null;
    const payload: LibraryCache = {
      version: CACHE_VERSION,
      fetchedAt: raw.fetchedAt,
      detailsFetchedAt: raw.detailsFetchedAt,
      rawSongs: raw.rawSongs,
      rawAlbums: raw.rawAlbums,
      albumDetails: raw.details,
    };
    void writeJson(CACHE_KEY, payload).catch((error) => {
      logWarn(`library: cache write failed: ${errorMessage(error)}`);
      console.warn("[library] 缓存写入失败", error);
    });
  }, 800);
}

export const useLibraryStore = create<LibraryState>((set, get) => {
  let raw: LibraryRawData = {
    rawSongs: [],
    rawAlbums: [],
    details: {},
    fetchedAt: 0,
    detailsFetchedAt: 0,
  };

  const commit = (partial: Partial<LibraryState> = {}): void => {
    const snapshot = applySnapshot(raw.rawSongs, raw.rawAlbums, raw.details);
    set({ ...snapshot, details: raw.details, ...partial });
  };

  const hydrateFromCache = async (): Promise<boolean> => {
    const cached =
      (await readJson<LibraryCache>(CACHE_KEY)) ?? (await readJson<LibraryCache>(LEGACY_CACHE_KEY));
    if (!cached || cached.version !== CACHE_VERSION) return false;
    if (!Array.isArray(cached.rawSongs) || !Array.isArray(cached.rawAlbums)) return false;

    raw = {
      rawSongs: cached.rawSongs,
      rawAlbums: cached.rawAlbums,
      details: cached.albumDetails ?? {},
      fetchedAt: cached.fetchedAt ?? 0,
      detailsFetchedAt: cached.detailsFetchedAt ?? 0,
    };
    commit({ status: "ready", error: null, fromCache: true });
    logInfo(
      `library: cache hit songs=${cached.rawSongs.length} albums=${cached.rawAlbums.length}`,
    );
    return true;
  };

  const fetchDetailsFor = async (albumIds: string[]): Promise<void> => {
    const pending = albumIds.filter((id) => !raw.details[id]);
    if (pending.length === 0) return;

    const total = pending.length;
    let loaded = 0;
    let cursor = 0;

    set({ detailProgress: { active: true, loaded: 0, total } });

    const worker = async (): Promise<void> => {
      while (cursor < pending.length) {
        const index = cursor;
        cursor += 1;
        const albumId = pending[index]!;
        try {
          const detail = await fetchAlbumDetail(albumId);
          raw.details[albumId] = detail;
        } catch (error) {
          logWarn(`library: detail failed [${albumId}]: ${errorMessage(error)}`);
          console.warn(`[library] 专辑 ${albumId} 详情获取失败`, error);
        }
        loaded += 1;
        if (loaded % 8 === 0 || loaded === total) {
          commit({ detailProgress: { active: loaded < total, loaded, total } });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, total) }, worker));

    raw.detailsFetchedAt = Date.now();
    commit({ detailProgress: { active: false, loaded, total } });
    scheduleCacheWrite(raw);
  };

  const runBulkDetails = async (): Promise<void> => {
    if (bulkRunning) return;
    bulkRunning = true;
    try {
      const albumIds = raw.rawAlbums.map((album) => String(album.cid));
      await fetchDetailsFor(albumIds);
    } finally {
      bulkRunning = false;
    }
  };

  const loadFromNetwork = async (): Promise<void> => {
    const [songsResult, albumsResult] = await Promise.allSettled([
      fetchSongList(),
      fetchAlbumList(),
    ]);

    const songsOk = songsResult.status === "fulfilled";
    const albumsOk = albumsResult.status === "fulfilled";

    if (!songsOk && !albumsOk) {
      const reason =
        songsResult.status === "rejected" ? songsResult.reason : (albumsResult as PromiseRejectedResult).reason;
      logWarn(`library: fetch failed: ${errorMessage(reason)}`);
      if (raw.rawSongs.length === 0 && raw.rawAlbums.length === 0) {
        set({ status: "error", error: errorMessage(reason) });
      } else {
        set({ status: "ready", error: errorMessage(reason), fromCache: true });
      }
      return;
    }

    if (songsOk) raw.rawSongs = songsResult.value;
    if (albumsOk) raw.rawAlbums = albumsResult.value;
    raw.fetchedAt = Date.now();

    commit({ status: "ready", error: null, fromCache: false });
    logInfo(
      `library: loaded songs=${raw.rawSongs.length} albums=${raw.rawAlbums.length} details=${Object.keys(raw.details).length}`,
    );
    scheduleCacheWrite(raw);

    const detailsStale = Date.now() - raw.detailsFetchedAt > DETAILS_TTL;
    const needsBulk =
      detailsStale && albumCoverage(get().songs) < DETAIL_COVERAGE_THRESHOLD;

    if (needsBulk) {
      void runBulkDetails().catch((error) => {
        console.warn("[library] 专辑详情批量加载失败", error);
      });
    }
  };

  return {
    status: "idle",
    error: null,
    songs: [],
    albums: [],
    songById: new Map(),
    albumById: new Map(),
    songsByAlbum: new Map(),
    details: {},
    detailProgress: { active: false, loaded: 0, total: 0 },
    fromCache: false,

    load: async (options) => {
      if (loadPromise && !options?.force) return loadPromise;

      loadPromise = (async () => {
        const hasData = get().songs.length > 0;
        if (!hasData) set({ status: "loading", error: null });

        if (isMockMode()) {
          try {
            const mock = await loadMockLibrary();
            raw = {
              rawSongs: mock.songs,
              rawAlbums: mock.albums,
              details: mock.details,
              fetchedAt: Date.now(),
              detailsFetchedAt: Date.now(),
            };
            commit({ status: "ready", error: null, fromCache: false });
          } catch (error) {
            set({ status: "error", error: errorMessage(error) });
          }
          return;
        }

        if (!hasData) {
          const hydrated = await hydrateFromCache();
          if (hydrated) {
            // 缓存先上屏，网络结果回来后再刷新，避免每次启动都空等接口。
            void loadFromNetwork();
            return;
          }
        }

        await loadFromNetwork();
      })().finally(() => {
        loadPromise = null;
      });

      return loadPromise;
    },

    retry: async () => {
      set({ status: "loading", error: null });
      await get().load({ force: true });
    },

    ensureAlbumDetail: async (albumId) => {
      if (!albumId) return false;
      if (raw.details[albumId]) return true;
      try {
        const detail = await fetchAlbumDetail(albumId);
        raw.details[albumId] = detail;
        commit();
        scheduleCacheWrite(raw);
        return true;
      } catch (error) {
        logWarn(`library: detail failed [${albumId}]: ${errorMessage(error)}`);
        console.warn(`[library] 专辑 ${albumId} 详情获取失败`, error);
        return false;
      }
    },
  };
});
