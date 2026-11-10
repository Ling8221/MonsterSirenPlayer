import { Play } from "lucide-react";
import type { Album } from "@/api/types";
import { Cover } from "@/components/Cover";
import { joinArtists } from "@/lib/format";
import { usePlaybackStore } from "@/store/usePlaybackStore";

interface AlbumCardProps {
  album: Album;
  onOpen: () => void;
}

export function AlbumCard({ album, onOpen }: AlbumCardProps) {
  const handlePlay = (): void => {
    if (album.songIds.length === 0) {
      onOpen();
      return;
    }
    usePlaybackStore.getState().playList(album.songIds, album.songIds[0]!);
  };

  return (
    <div
      className="album-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="album-card-cover">
        <Cover src={album.coverUrl} name={album.name} />
        <button
          type="button"
          className="album-card-play"
          title="播放这张专辑"
          aria-label={`播放 ${album.name}`}
          onClick={(event) => {
            event.stopPropagation();
            handlePlay();
          }}
        >
          <Play size={20} fill="currentColor" strokeWidth={0} />
        </button>
      </div>
      <div className="album-card-meta">
        <span className="album-card-name" title={album.name}>
          {album.name}
        </span>
        <span className="album-card-artist" title={joinArtists(album.artists)}>
          {joinArtists(album.artists)}
        </span>
      </div>
    </div>
  );
}
