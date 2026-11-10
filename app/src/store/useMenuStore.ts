import { create } from "zustand";

interface MenuState {
  songId: string | null;
  x: number;
  y: number;
  open: (songId: string, x: number, y: number) => void;
  close: () => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  songId: null,
  x: 0,
  y: 0,
  open: (songId, x, y) => set({ songId, x, y }),
  close: () => set({ songId: null }),
}));
