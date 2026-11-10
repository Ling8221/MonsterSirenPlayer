import { create } from "zustand";
import { fetchSongDetail } from "@/api/client";
import type { SongDetail } from "@/api/types";
import { cleanName, joinArtists, pickArtists } from "@/lib/format";
import { logError, logInfo } from "@/lib/logger";
import {
  applyMode,
  appendToQueue,
  buildQueue,
  clearQueue,
  currentId,
  insertNext,
  moveInQueue,
  nextIndex,
  previousIndex,
  removeAt,
  type PlayMode,
  type QueueState,
} from "@/lib/queue";
import { readJson, writeJson } from "@/lib/storage";
import { audioEngine } from "@/play/audioEngine";
import { useLibraryStore } from "./useLibraryStore";
import { useLyricsStore } from "./useLyricsStore";
import { toast } from "./useToastStore";

const PERSIST_KEY = "session";
const LEGACY_PERSIST_KEY = "playback";
const PERSIST_VERSION = 1;

export interface CurrentTrack {
  id: string;
  name: string;
  artists: string[];
  albumId: string | null;
}

interface PersistedPlayback {
  version: number;
  queue: string[];
  baseQueue: string[];
  index: number;
  mode: PlayMode;
  volume: number;
  muted: boolean;
}

interface PlaybackState {
  queue: string[];
  baseQueue: string[];
  index: number;
  mode: PlayMode;
  /** 0–1 */
  volume: number;
  muted: boolean;
  current: CurrentTrack | null;
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  playList: (ids: readonly string[], startId: string) => void;
  playSong: (id: string) => void;
  jumpTo: (index: number) => void;
  next: (auto?: boolean) => void;
  previous: () => void;
  toggle: () => void;
  stop: () => void;
  cycleMode: () => void;
  setMode: (mode: PlayMode) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  addNext: (id: string) => void;
  addToQueue: (id: string) => void;
  removeAt: (index: number) => void;
  move: (from: number, to: number) => void;
  clear: () => void;
  reload: () => void;
}

const detailCache = new Map<string, SongDetail>();
const detailInflight = new Map<string, Promise<SongDetail>>();

async function getSongDetail(id: string): Promise<SongDetail> {
  const cached = detailCache.get(id);
  if (cached) return cached;

  const running = detailInflight.get(id);
  if (running) return running;

  const task = fetchSongDetail(id)
    .then((raw) => {
      const audioUrl = (raw.sourceUrl ?? "").trim();
      if (!audioUrl) throw new Error("这首歌暂时没有可用的音频地址");

      const fallbackName = useLibraryStore.getState().songById.get(id)?.name ?? "未知歌曲";
      const detail: SongDetail = {
        id: String(raw.cid ?? id),
        name: cleanName(raw.name) || fallbackName,
        artists: pickArtists(raw.artists, raw.artistes),
        albumId: raw.albumCid ? String(raw.albumCid) : null,
        audioUrl,
        lyricUrl: raw.lyricUrl ? raw.lyricUrl.trim() : null,
      };
      detailCache.set(id, detail);
      return detail;
    })
    .finally(() => {
      detailInflight.delete(id);
    });

  detailInflight.set(id, task);
  return task;
}

const MODE_CYCLE: PlayMode[] = ["single", "list-loop", "single-loop", "shuffle"];

export const usePlaybackStore = create<PlaybackState>((set, get) => {
  let loadSeq = 0;

  const queueState = (): QueueState => {
    const { queue, baseQueue, index, mode } = get();
    return { queue, baseQueue, index, mode };
  };

  const loadCurrent = async (autoplay: boolean): Promise<void> => {
    const id = currentId(queueState());
    const token = ++loadSeq;

    if (!id) {
      set({ current: null, loading: false });
      audioEngine.stop();
      useLyricsStore.getState().clear();
      return;
    }

    set({ loading: true, error: null });
    try {
      const detail = await getSongDetail(id);
      if (token !== loadSeq) return;

      audioEngine.load(detail.audioUrl);
      audioEngine.setVolume(get().volume, get().muted);

      const track: CurrentTrack = {
        id: detail.id,
        name: detail.name,
        artists: detail.artists,
        albumId: detail.albumId,
      };
      set({ current: track, loading: false });
      logInfo(`play: ${detail.name} — ${joinArtists(detail.artists)} [${detail.id}]`);

      if (autoplay) audioEngine.play();
      void useLyricsStore.getState().load(id, detail.lyricUrl);

      const album = detail.albumId
        ? useLibraryStore.getState().albumById.get(detail.albumId)
        : null;
      audioEngine.updateMediaSessionMetadata({
        title: detail.name,
        artist: joinArtists(detail.artists),
        album: album?.name ?? "塞壬唱片",
        artwork: album?.coverUrl,
      });
    } catch (error) {
      if (token !== loadSeq) return;
      const message = error instanceof Error ? error.message : String(error);
      set({ loading: false, error: message });
      logError(`play failed [${id}]: ${message}`);
      toast(`播放失败：${message}`, "error");
    }
  };

  const jump = (index: number): void => {
    const length = get().queue.length;
    if (length === 0) return;
    const clamped = Math.min(Math.max(index, 0), length - 1);
    set({ index: clamped });
    void loadCurrent(true);
  };

  const playFirstAvailable = (): void => {
    const { songs } = useLibraryStore.getState();
    if (songs.length === 0) {
      toast("曲库还没加载完，先等一下", "info");
      return;
    }
    const seed = songs.slice(0, 40);
    const ids = seed.map((song) => song.id);
    const start = ids[0]!;
    set(buildQueue(ids, start, get().mode));
    void loadCurrent(true);
  };

  return {
    queue: [],
    baseQueue: [],
    index: -1,
    mode: "list-loop",
    volume: 0.7,
    muted: false,
    current: null,
    loading: false,
    error: null,
    hydrated: false,

    hydrate: async () => {
      if (get().hydrated) return;
      const saved =
        (await readJson<PersistedPlayback>(PERSIST_KEY)) ??
        (await readJson<PersistedPlayback>(LEGACY_PERSIST_KEY));

      if (!saved || saved.version !== PERSIST_VERSION) {
        set({ hydrated: true });
        return;
      }

      const queue = Array.isArray(saved.queue) ? saved.queue.filter((id) => typeof id === "string") : [];
      const baseQueue = Array.isArray(saved.baseQueue)
        ? saved.baseQueue.filter((id) => typeof id === "string")
        : queue.slice();
      const index =
        queue.length === 0 ? -1 : Math.min(Math.max(Number(saved.index) || 0, 0), queue.length - 1);
      const volume = Number.isFinite(saved.volume) ? Math.min(Math.max(saved.volume, 0), 1) : 0.7;
      const mode = MODE_CYCLE.includes(saved.mode) ? saved.mode : "list-loop";

      set({
        queue,
        baseQueue,
        index,
        mode,
        volume,
        muted: Boolean(saved.muted),
        hydrated: true,
      });
      audioEngine.setVolume(volume, Boolean(saved.muted));
      logInfo(`restore: queue=${queue.length} index=${index} mode=${mode}`);

      if (queue.length > 0) {
        // 恢复上次的队列但不自动出声，避免一打开应用就吓人一跳。
        void loadCurrent(false);
      }
    },

    playList: (ids, startId) => {
      if (ids.length === 0) return;
      set(buildQueue(ids, startId, get().mode));
      void loadCurrent(true);
    },

    playSong: (id) => {
      const state = get();
      const at = state.queue.indexOf(id);
      if (at >= 0) {
        set({ index: at });
        void loadCurrent(true);
        return;
      }
      const next = appendToQueue(queueState(), id);
      set({ ...next, index: next.queue.indexOf(id) });
      void loadCurrent(true);
    },

    jumpTo: jump,

    next: (auto = false) => {
      const target = nextIndex(queueState(), auto);
      if (target === null) {
        if (auto) audioEngine.pause();
        return;
      }
      if (auto) logInfo("auto next");
      set({ index: target });
      void loadCurrent(true);
    },

    previous: () => {
      const target = previousIndex(queueState());
      if (target === null) return;
      set({ index: target });
      void loadCurrent(true);
    },

    toggle: () => {
      const { current } = get();
      if (!current) {
        playFirstAvailable();
        return;
      }
      if (audioEngine.audio.paused) {
        logInfo("player: play");
        audioEngine.play();
      } else {
        logInfo("player: pause");
        audioEngine.pause();
      }
    },

    stop: () => {
      logInfo("player: stop");
      audioEngine.stop();
      set({ current: null, index: -1, queue: [], baseQueue: [] });
    },

    cycleMode: () => {
      const { mode } = get();
      const at = MODE_CYCLE.indexOf(mode);
      const target = MODE_CYCLE[(at + 1) % MODE_CYCLE.length]!;
      logInfo(`mode: ${target}`);
      set(applyMode(queueState(), target));
    },

    setMode: (mode) => {
      logInfo(`mode: ${mode}`);
      set(applyMode(queueState(), mode));
    },

    setVolume: (volume) => {
      const clamped = Math.min(Math.max(volume, 0), 1);
      const muted = clamped === 0 ? get().muted : false;
      set({ volume: clamped, muted });
      audioEngine.setVolume(clamped, muted);
    },

    toggleMute: () => {
      const muted = !get().muted;
      logInfo(`volume: muted=${muted}`);
      set({ muted });
      audioEngine.setVolume(get().volume, muted);
    },

    addNext: (id) => {
      const next = insertNext(queueState(), id);
      set(next);
      logInfo(`queue: add next ${id}`);
      toast("已加入下一首播放", "success");
    },

    addToQueue: (id) => {
      const next = appendToQueue(queueState(), id);
      set(next);
      logInfo(`queue: add ${id}`);
      toast("已添加到播放队列", "success");
    },

    removeAt: (index) => {
      const state = get();
      const wasCurrent = state.index === index;
      const next = removeAt(queueState(), index);
      set(next);
      logInfo(`queue: remove index=${index}`);

      if (next.queue.length === 0) {
        audioEngine.stop();
        set({ current: null });
        useLyricsStore.getState().clear();
        return;
      }
      if (wasCurrent) {
        void loadCurrent(true);
      }
    },

    move: (from, to) => {
      set(moveInQueue(queueState(), from, to));
    },

    clear: () => {
      logInfo("queue: clear");
      set(clearQueue(queueState()));
      audioEngine.stop();
      useLyricsStore.getState().clear();
      set({ current: null, loading: false });
    },

    reload: () => {
      const id = currentId(queueState());
      if (!id) return;
      detailCache.delete(id);
      void loadCurrent(true);
    },
  };
});

let saveTimer: number | null = null;

usePlaybackStore.subscribe((state, previous) => {
  if (!state.hydrated) return;
  const changed =
    state.queue !== previous.queue ||
    state.baseQueue !== previous.baseQueue ||
    state.index !== previous.index ||
    state.mode !== previous.mode ||
    state.volume !== previous.volume ||
    state.muted !== previous.muted;
  if (!changed) return;

  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    const snapshot = usePlaybackStore.getState();
    const payload: PersistedPlayback = {
      version: PERSIST_VERSION,
      queue: snapshot.queue,
      baseQueue: snapshot.baseQueue,
      index: snapshot.index,
      mode: snapshot.mode,
      volume: snapshot.volume,
      muted: snapshot.muted,
    };
    void writeJson(PERSIST_KEY, payload).catch((error) => {
      console.warn("[playback] 状态保存失败", error);
    });
  }, 400);
});
