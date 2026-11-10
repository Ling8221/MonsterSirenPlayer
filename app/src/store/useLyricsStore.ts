import { create } from "zustand";
import { fetchRemoteText } from "@/api/client";
import { logWarn } from "@/lib/logger";
import { EMPTY_LYRICS, parseLrc, type LyricsDocument } from "@/lib/lrc";

export type LyricsStatus = "idle" | "loading" | "ready" | "empty" | "error";

interface LyricsState {
  songId: string | null;
  status: LyricsStatus;
  document: LyricsDocument | null;
  error: string | null;
  load: (songId: string, url: string | null) => Promise<void>;
  clear: () => void;
}

const cache = new Map<string, LyricsDocument>();
let requestSeq = 0;

export const useLyricsStore = create<LyricsState>((set, get) => ({
  songId: null,
  status: "idle",
  document: null,
  error: null,

  load: async (songId, url) => {
    if (!songId) {
      set({ songId: null, status: "idle", document: null, error: null });
      return;
    }

    const cached = cache.get(songId);
    if (cached) {
      set({ songId, status: cached.lines.length > 0 || cached.plain ? "ready" : "empty", document: cached, error: null });
      return;
    }

    if (!url) {
      const empty = { ...EMPTY_LYRICS };
      cache.set(songId, empty);
      set({ songId, status: "empty", document: empty, error: null });
      return;
    }

    const token = ++requestSeq;
    set({ songId, status: "loading", document: null, error: null });

    try {
      const text = await fetchRemoteText(url);
      if (get().songId !== songId || token !== requestSeq) return;

      const document = parseLrc(text);
      cache.set(songId, document);
      const isEmpty = document.lines.length === 0 && !document.plain;
      set({ status: isEmpty ? "empty" : "ready", document, error: null });
    } catch (error) {
      if (get().songId !== songId || token !== requestSeq) return;
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`lyrics failed [${songId}]: ${message}`);
      set({ status: "error", document: null, error: message });
    }
  },

  clear: () => {
    requestSeq += 1;
    set({ songId: null, status: "idle", document: null, error: null });
  },
}));
