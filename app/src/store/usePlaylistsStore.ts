import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Playlist } from "@/api/types";
import { logInfo } from "@/lib/logger";
import { createSectionStorage } from "@/lib/storage";

function createId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function touch(playlist: Playlist, songIds: string[]): Playlist {
  return { ...playlist, songIds, updatedAt: Date.now() };
}

interface PlaylistState {
  items: Playlist[];
  hydrated: boolean;
  markHydrated: () => void;
  create: (name: string, songIds?: string[]) => Playlist;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  addSongs: (id: string, songIds: readonly string[]) => number;
  removeSong: (id: string, songId: string) => void;
  reorder: (id: string, from: number, to: number) => void;
}

export const usePlaylistsStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,

      markHydrated: () => set({ hydrated: true }),

      create: (rawName, songIds = []) => {
        const now = Date.now();
        const playlist: Playlist = {
          id: createId(),
          name: rawName.trim() || "新建歌单",
          songIds: [...new Set(songIds)],
          createdAt: now,
          updatedAt: now,
        };
        set({ items: [playlist, ...get().items] });
        logInfo(`playlist: create "${playlist.name}" songs=${playlist.songIds.length}`);
        return playlist;
      },

      rename: (id, rawName) => {
        const name = rawName.trim();
        if (!name) return;
        logInfo(`playlist: rename ${id} -> "${name}"`);
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, name, updatedAt: Date.now() } : item,
          ),
        });
      },

      remove: (id) => {
        logInfo(`playlist: remove ${id}`);
        set({ items: get().items.filter((item) => item.id !== id) });
      },

      addSongs: (id, songIds) => {
        let added = 0;
        set({
          items: get().items.map((item) => {
            if (item.id !== id) return item;
            const next = [...item.songIds];
            for (const songId of songIds) {
              if (!next.includes(songId)) {
                next.push(songId);
                added += 1;
              }
            }
            return added > 0 ? touch(item, next) : item;
          }),
        });
        if (added > 0) logInfo(`playlist: add ${added} songs to ${id}`);
        return added;
      },

      removeSong: (id, songId) => {
        const target = get().items.find((item) => item.id === id);
        if (!target || !target.songIds.includes(songId)) return;
        logInfo(`playlist: remove song ${songId} from ${id}`);
        set({
          items: get().items.map((item) =>
            item.id === id && item.songIds.includes(songId)
              ? touch(item, item.songIds.filter((value) => value !== songId))
              : item,
          ),
        });
      },

      reorder: (id, from, to) => {
        logInfo(`playlist: reorder ${id} ${from}->${to}`);
        set({
          items: get().items.map((item) => {
            if (item.id !== id) return item;
            if (from < 0 || from >= item.songIds.length) return item;
            if (to < 0 || to >= item.songIds.length) return item;
            if (from === to) return item;
            const songIds = item.songIds.slice();
            const [moved] = songIds.splice(from, 1);
            songIds.splice(to, 0, moved!);
            return touch(item, songIds);
          }),
        });
      },
    }),
    {
      name: "playlists",
      version: 1,
      storage: createJSONStorage(() => createSectionStorage("library")),
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn("[playlists] 读取失败", error);
        state?.markHydrated();
      },
    },
  ),
);
