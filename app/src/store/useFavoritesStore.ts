import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { logInfo } from "@/lib/logger";
import { createSectionStorage } from "@/lib/storage";

interface FavoritesState {
  ids: string[];
  hydrated: boolean;
  has: (songId: string) => boolean;
  toggle: (songId: string) => boolean;
  add: (songId: string) => void;
  remove: (songId: string) => void;
  reorder: (from: number, to: number) => void;
  markHydrated: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      hydrated: false,

      has: (songId) => get().ids.includes(songId),

      toggle: (songId) => {
        const exists = get().ids.includes(songId);
        if (exists) {
          logInfo(`favorite: off ${songId}`);
          set({ ids: get().ids.filter((id) => id !== songId) });
          return false;
        }
        logInfo(`favorite: on ${songId}`);
        set({ ids: [songId, ...get().ids] });
        return true;
      },

      add: (songId) => {
        if (get().ids.includes(songId)) return;
        logInfo(`favorite: on ${songId}`);
        set({ ids: [songId, ...get().ids] });
      },

      remove: (songId) => {
        logInfo(`favorite: off ${songId}`);
        set({ ids: get().ids.filter((id) => id !== songId) });
      },

      reorder: (from, to) => {
        const ids = get().ids;
        if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to) return;
        logInfo(`favorite: reorder ${from}->${to}`);
        const next = ids.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        set({ ids: next });
      },

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "favorites",
      version: 1,
      storage: createJSONStorage(() => createSectionStorage("library")),
      partialize: (state) => ({ ids: state.ids }),
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn("[favorites] 读取失败", error);
        state?.markHydrated();
      },
    },
  ),
);
