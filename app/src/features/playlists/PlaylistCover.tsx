import { ListMusic } from "lucide-react";
import type { Album, Song } from "@/api/types";
import { Cover } from "@/components/Cover";

interface PlaylistCoverProps {
  songIds: readonly string[];
  songIndex: Map<string, Song>;
  albumIndex: Map<string, Album>;
  className?: string;
}

/** 歌单封面：取前四首歌的专辑封面拼成 2×2；不足四张时用单张或占位图。 */
export function PlaylistCover({ songIds, songIndex, albumIndex, className = "" }: PlaylistCoverProps) {
  const covers = songIds
    .map((id) => songIndex.get(id))
    .map((song) => (song?.albumId ? albumIndex.get(song.albumId) : undefined))
    .filter((album): album is Album => Boolean(album))
    .slice(0, 4);

  if (covers.length === 0) {
    return (
      <div className={`playlist-cover playlist-cover-empty ${className}`.trim()}>
        <ListMusic size={26} />
      </div>
    );
  }

  if (covers.length === 1) {
    return (
      <div className={`playlist-cover ${className}`.trim()}>
        <Cover src={covers[0]!.coverUrl} name={covers[0]!.name} />
      </div>
    );
  }

  return (
    <div className={`playlist-cover playlist-cover-grid ${className}`.trim()}>
      {covers.map((album, index) => (
        <Cover key={`${album.id}-${index}`} src={album.coverUrl} name={album.name} />
      ))}
    </div>
  );
}
