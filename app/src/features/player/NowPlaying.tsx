import { useEffect, useRef, useState } from "react";
import { ChevronDown, Disc3, ListMusic } from "lucide-react";
import { Cover } from "@/components/Cover";
import { WindowControls } from "@/components/WindowControls";
import { joinArtists } from "@/lib/format";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useUiStore } from "@/store/useUiStore";
import { useWindowStore } from "@/store/useWindowStore";
import { LyricsPanel } from "./LyricsPanel";
import { ProgressBar } from "./ProgressBar";
import { QueuePanel } from "./QueuePanel";
import { TransportControls } from "./TransportControls";
import { VolumeControl } from "./VolumeControl";

export function NowPlaying() {
  const open = useUiStore((state) => state.nowPlayingOpen);
  const close = useUiStore((state) => state.closeNowPlaying);
  const queueOpen = useUiStore((state) => state.nowPlayingQueueOpen);
  const setQueueOpen = useUiStore((state) => state.setNowPlayingQueueOpen);
  const toggleMaximize = useWindowStore((state) => state.toggleMaximize);
  const current = usePlaybackStore((state) => state.current);
  const album = useLibraryStore((state) =>
    current?.albumId ? state.albumById.get(current.albumId) : undefined,
  );
  const wide = useMediaQuery("(min-width: 960px)");
  const [showLyrics, setShowLyrics] = useState(false);
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);
  const queueWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
      return;
    }
    if (!visible) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setShowLyrics(false);
      setQueueOpen(false);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [open, visible, setQueueOpen]);

  useEffect(() => {
    if (!queueOpen) return;
    const handlePointerDown = (event: PointerEvent): void => {
      if (queueWrapRef.current?.contains(event.target as Node)) return;
      setQueueOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [queueOpen, setQueueOpen]);

  if (!visible) return null;

  const coverPane = !wide && showLyrics ? null : (
    <div
      className="np-cover-pane"
      onClick={() => {
        if (!wide) setShowLyrics(true);
      }}
      role={wide ? undefined : "button"}
      tabIndex={wide ? -1 : 0}
      onKeyDown={(event) => {
        if (!wide && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          setShowLyrics(true);
        }
      }}
    >
      <Cover src={album?.coverUrl} name={current?.name ?? "塞壬唱片"} className="np-cover" eager />
      <div className="np-cover-caption">
        <span className="np-disc">
          <Disc3 size={16} />
          {album?.name ?? "塞壬唱片"}
        </span>
        {!wide ? <span className="np-cover-tip">点击查看歌词</span> : null}
      </div>
    </div>
  );

  const lyricsPane = !wide && !showLyrics ? null : (
    <div className="np-lyrics-pane">
      {!wide ? (
        <button
          type="button"
          className="np-lyrics-back text-btn"
          onClick={() => setShowLyrics(false)}
        >
          <ChevronDown size={15} />
          收起歌词
        </button>
      ) : null}
      <LyricsPanel visible />
    </div>
  );

  return (
    <section className={`now-playing${closing ? " is-closing" : ""}`} aria-label="正在播放">
      <div
        className="np-backdrop"
        style={album?.coverUrl ? { backgroundImage: `url("${album.coverUrl}")` } : undefined}
      />
      <div className="np-scrim" />

      <header
        className="np-topbar"
        data-tauri-drag-region
        onDoubleClick={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          toggleMaximize();
        }}
      >
        <WindowControls />
      </header>

      <div className="np-body">
        {coverPane}
        {lyricsPane}
      </div>

      <div className="np-footer">
        <div className="np-info">
          <h2 className="np-title" title={current?.name ?? ""}>
            {current?.name ?? "未在播放"}
          </h2>
          <p className="np-artists">{current ? joinArtists(current.artists) : "选择一首歌曲开始"}</p>
        </div>

        <ProgressBar />

        <div className="np-controls">
          <button
            type="button"
            className="icon-btn np-collapse"
            onClick={close}
            title="收起"
            aria-label="收起"
          >
            <ChevronDown size={20} />
          </button>

          <TransportControls variant="immersive" />

          <div className="np-extra">
            <div className="queue-wrap" ref={queueWrapRef}>
              <button
                type="button"
                className={`icon-btn${queueOpen ? " is-active" : ""}`}
                onClick={() => setQueueOpen(!queueOpen)}
                title="播放队列"
                aria-label="播放队列"
                aria-expanded={queueOpen}
              >
                <ListMusic size={19} />
              </button>
              {queueOpen ? (
                <div className="queue-popover np-queue-popover">
                  <QueuePanel variant="popup" />
                </div>
              ) : null}
            </div>
            <div className="np-volume">
              <VolumeControl />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
