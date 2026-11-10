import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, ListEnd, ListPlus, ListMusic, Play } from "lucide-react";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { useMenuStore } from "@/store/useMenuStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useUiStore } from "@/store/useUiStore";

const MENU_WIDTH = 208;

export function SongContextMenu() {
  const { songId, x, y, close } = useMenuStore();
  const openDialog = useUiStore((state) => state.openDialog);
  const favorite = useFavoritesStore((state) =>
    songId ? state.ids.includes(songId) : false,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!songId) return;
    const menu = menuRef.current;
    const height = menu?.offsetHeight ?? 220;
    const left = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - height - 8));
    setPosition({ left, top });
  }, [songId, x, y]);

  useEffect(() => {
    if (!songId) return;
    const handlePointerDown = (event: PointerEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };
    const handleScroll = (): void => close();

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [songId, close]);

  if (!songId) return null;

  const run = (action: () => void) => () => {
    action();
    close();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: position.left, top: position.top, width: MENU_WIDTH }}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className="context-item"
        onClick={run(() => usePlaybackStore.getState().playSong(songId))}
      >
        <Play size={15} />
        播放
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-item"
        onClick={run(() => usePlaybackStore.getState().addNext(songId))}
      >
        <ListPlus size={15} />
        下一首播放
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-item"
        onClick={run(() => usePlaybackStore.getState().addToQueue(songId))}
      >
        <ListEnd size={15} />
        添加到播放队列
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-item"
        onClick={run(() => openDialog({ type: "add-to-playlist", songIds: [songId] }))}
      >
        <ListMusic size={15} />
        添加到歌单…
      </button>

      <div className="context-sep" />

      <button
        type="button"
        role="menuitem"
        className={`context-item${favorite ? " faved" : ""}`}
        onClick={run(() => useFavoritesStore.getState().toggle(songId))}
      >
        <Heart size={15} fill={favorite ? "currentColor" : "none"} />
        {favorite ? "取消收藏" : "收藏"}
      </button>
    </div>,
    document.body,
  );
}
