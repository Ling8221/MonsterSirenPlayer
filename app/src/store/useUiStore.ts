import { create } from "zustand";
import { logInfo } from "@/lib/logger";

export type ViewSpec =
  | { name: "home" }
  | { name: "search" }
  | { name: "songs" }
  | { name: "albums" }
  | { name: "favorites" }
  | { name: "playlists" }
  | { name: "settings" }
  | { name: "album"; id: string }
  | { name: "playlist"; id: string };

export type DialogState =
  | { type: "create-playlist"; songIds: string[] }
  | { type: "rename-playlist"; playlistId: string }
  | { type: "delete-playlist"; playlistId: string }
  | { type: "add-to-playlist"; songIds: string[] };

export function sameView(a: ViewSpec, b: ViewSpec): boolean {
  if (a.name !== b.name) return false;
  const left = "id" in a ? a.id : null;
  const right = "id" in b ? b.id : null;
  return left === right;
}

function describeView(view: ViewSpec): string {
  return "id" in view ? `${view.name}:${view.id}` : view.name;
}

interface UiState {
  view: ViewSpec;
  history: ViewSpec[];
  searchKeyword: string;
  nowPlayingOpen: boolean;
  /** 底栏队列弹层 */
  queueOpen: boolean;
  /** 沉浸式页面里的队列抽屉 */
  nowPlayingQueueOpen: boolean;
  sidebarOpen: boolean;
  dialog: DialogState | null;

  navigate: (view: ViewSpec) => void;
  back: () => boolean;
  setSearchKeyword: (keyword: string) => void;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
  toggleQueue: () => void;
  closeQueue: () => void;
  setNowPlayingQueueOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  openDialog: (dialog: DialogState) => void;
  closeDialog: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  view: { name: "home" },
  history: [],
  searchKeyword: "",
  nowPlayingOpen: false,
  queueOpen: false,
  nowPlayingQueueOpen: false,
  sidebarOpen: false,
  dialog: null,

  navigate: (view) => {
    const { view: current, history } = get();
    if (sameView(current, view)) {
      set({ sidebarOpen: false, queueOpen: false });
      return;
    }
    logInfo(`nav: ${describeView(view)}`);
    set({
      view,
      history: [...history, current].slice(-30),
      sidebarOpen: false,
      queueOpen: false,
    });
  },

  back: () => {
    const { history } = get();
    if (history.length === 0) return false;
    const previous = history[history.length - 1]!;
    logInfo(`nav back: ${describeView(previous)}`);
    set({ view: previous, history: history.slice(0, -1), queueOpen: false });
    return true;
  },

  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  openNowPlaying: () => set({ nowPlayingOpen: true, queueOpen: false }),
  closeNowPlaying: () => set({ nowPlayingOpen: false, nowPlayingQueueOpen: false }),
  toggleQueue: () => set({ queueOpen: !get().queueOpen }),
  closeQueue: () => set({ queueOpen: false }),
  setNowPlayingQueueOpen: (open) => set({ nowPlayingQueueOpen: open }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openDialog: (dialog) => set({ dialog, queueOpen: false }),
  closeDialog: () => set({ dialog: null }),
}));
