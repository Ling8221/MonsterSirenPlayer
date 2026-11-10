import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import type { Song } from "@/api/types";
import { Cover } from "@/components/Cover";
import { EmptyState, ErrorState } from "@/components/State";
import { SongList } from "@/features/songs/SongList";
import { joinArtists } from "@/lib/format";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useUiStore } from "@/store/useUiStore";

export function AlbumDetailView({ albumId }: { albumId: string }) {
  const album = useLibraryStore((state) => state.albumById.get(albumId));
  const songById = useLibraryStore((state) => state.songById);
  const albumById = useLibraryStore((state) => state.albumById);
  const back = useUiStore((state) => state.back);
  const [detailFailed, setDetailFailed] = useState(false);

  const loadDetail = useCallback(async (): Promise<void> => {
    setDetailFailed(false);
    const ok = await useLibraryStore.getState().ensureAlbumDetail(albumId);
    if (!ok) setDetailFailed(true);
  }, [albumId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const songs = useMemo<Song[]>(() => {
    if (!album) return [];
    const ordered = album.songIds
      .map((id) => songById.get(id))
      .filter((song): song is Song => Boolean(song));
    if (ordered.length > 0) return ordered;
    // 详情接口尚未返回时，先用已知的专辑归属兜底。
    return [...songById.values()].filter((song) => song.albumId === album.id);
  }, [album, songById]);

  if (!album) {
    return (
      <div className="view">
        <EmptyState
          title="专辑不存在"
          description="可能链接已经失效"
          action={
            <button type="button" className="btn" onClick={() => back()}>
              返回
            </button>
          }
        />
      </div>
    );
  }

  const playAll = (): void => {
    if (songs.length === 0) return;
    usePlaybackStore.getState().playList(
      songs.map((song) => song.id),
      songs[0]!.id,
    );
  };

  return (
    <div className="view view-fill">
      <div className="detail-header">
        <button type="button" className="icon-btn detail-back" onClick={() => back()} title="返回">
          <ArrowLeft size={18} />
        </button>

        <Cover src={album.coverUrl} name={album.name} className="detail-cover" eager />

        <div className="detail-meta">
          <p className="detail-eyebrow">专辑</p>
          <h1>{album.name}</h1>
          <p className="detail-artists">{joinArtists(album.artists)}</p>
          {album.intro ? <p className="detail-intro">{album.intro}</p> : null}
          <div className="detail-actions">
            <button type="button" className="btn btn-primary" onClick={playAll} disabled={songs.length === 0}>
              <Play size={16} fill="currentColor" strokeWidth={0} />
              播放全部
            </button>
            <span className="detail-count">{songs.length} 首歌曲</span>
          </div>
        </div>
      </div>

      <div className="detail-body">
        {songs.length === 0 && detailFailed ? (
          <ErrorState
            message="没能取到这张专辑的曲目，可能是网络问题。"
            onRetry={() => {
              void loadDetail();
            }}
          />
        ) : (
          <SongList
            songs={songs}
            albumIndex={albumById}
            emptyTitle="正在读取曲目…"
            emptyDescription="如果一直停在这里，可以返回上一页再进来重试。"
          />
        )}
      </div>
    </div>
  );
}
