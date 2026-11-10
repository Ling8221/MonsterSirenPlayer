import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  items: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const timers = new Map<number, number>();

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],

  push: (message, tone = "info") => {
    const id = nextId++;
    set({ items: [...get().items, { id, message, tone }].slice(-4) });
    const timer = window.setTimeout(() => {
      timers.delete(id);
      set({ items: get().items.filter((item) => item.id !== id) });
    }, 2600);
    timers.set(id, timer);
  },

  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.delete(id);
    }
    set({ items: get().items.filter((item) => item.id !== id) });
  },
}));

export function toast(message: string, tone: ToastTone = "info"): void {
  useToastStore.getState().push(message, tone);
}
