import { useEffect, useMemo } from "react";
import { ArrowRight, Disc3, Play } from "lucide-react";
import { Cover } from "@/components/Cover";
import { ErrorState, LoadingState } from "@/components/State";
import { latestAlbums } from "@/data/library";
import { joinArtists } from "@/lib/format";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useUiStore } from "@/store/useUiStore";

export function HomeView() {
  const albums = useLibraryStore((state) => state.albums);
  const songs = useLibraryStore((state) => state.songs);
  const songsByAlbum = useLibraryStore((state) => state.songsByAlbum);
  const ensureAlbumDetail = useLibraryStore((state) => state.ensureAlbumDetail);
  const status = useLibraryStore((state) => state.status);
  const error = useLibraryStore((state) => state.error);
  const navigate = useUiStore((state) => state.navigate);

  const featured = useMemo(() => latestAlbums(albums, 1)[0] ?? null, [albums]);

  useEffect(() => {
    if (!featured) return;
    if (!featured.intro || featured.songIds.length === 0) {
      void ensureAlbumDetail(featured.id);
    }
  }, [featured, ensureAlbumDetail]);

  if (status === "loading" && albums.length === 0) {
    return <LoadingState text="正在加载塞壬唱片曲库…" />;
  }

  if (status === "error") {
    return (
      <ErrorState
        message={error ?? "无法连接塞壬唱片接口"}
        onRetry={() => {
          void useLibraryStore.getState().retry();
        }}
      />
    );
  }

  const trackIds = featured
    ? featured.songIds.length > 0
      ? featured.songIds
      : (songsByAlbum.get(featured.id) ?? []).map((song) => song.id)
    : [];

  const openFeatured = (): void => {
    if (featured) navigate({ name: "album", id: featured.id });
  };

  const playFeatured = (): void => {
    if (!featured) return;
    if (trackIds.length === 0) {
      openFeatured();
      return;
    }
    usePlaybackStore.getState().playList(trackIds, trackIds[0]!);
  };

  return (
    <div className="view-scroll home-view">
      <section className="hero">
        <div className="hero-mark">
          <img src="/icon-white.png" alt="" />
        </div>
        <div className="hero-text">
          <h1>塞壬唱片 MSR</h1>
          <p className="hero-desc">
            泰拉世界十一世纪最大的音乐发行商之一。从异教重金属乐队到偶像产业，
            塞壬唱片 MSR 旗下的签约艺人涉猎音乐各方面；据统计，它占有泰拉世界 30% 以上的音乐市场。
          </p>
          <div className="hero-stats">
            <span>{albums.length} 张专辑</span>
            <span className="dot" />
            <span>{songs.length} 首歌曲</span>
          </div>
        </div>
      </section>

      <section className="section">
        <header className="section-head">
          <h2>
            <Disc3 size={18} />
            最新专辑
          </h2>
          <button
            type="button"
            className="text-btn"
            onClick={() => navigate({ name: "albums" })}
          >
            查看全部
            <ArrowRight size={15} />
          </button>
        </header>

        {featured ? (
          <article
            className="featured-album"
            role="button"
            tabIndex={0}
            onClick={openFeatured}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openFeatured();
              }
            }}
          >
            <div className="featured-cover">
              <Cover src={featured.coverUrl} name={featured.name} eager />
            </div>

            <div className="featured-body">
              <h3 className="featured-name">{featured.name}</h3>
              <p className="featured-artists">
                {joinArtists(featured.artists) || "塞壬唱片 MSR"}
              </p>
              <p className="featured-intro">
                {featured.intro || "点击查看专辑简介与完整曲目。"}
              </p>
              <div
                className="featured-actions"
                onClick={(event) => event.stopPropagation()}
              >
                <button type="button" className="btn btn-primary" onClick={playFeatured}>
                  <Play size={15} fill="currentColor" strokeWidth={0} />
                  播放专辑
                </button>
                <button type="button" className="btn" onClick={openFeatured}>
                  查看详情
                  <ArrowRight size={15} />
                </button>
                <span className="featured-meta">{trackIds.length} 首歌曲</span>
              </div>
            </div>
          </article>
        ) : null}
      </section>
    </div>
  );
}
