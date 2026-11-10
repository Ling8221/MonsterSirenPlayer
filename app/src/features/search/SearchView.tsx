import { ChevronDown, SearchX, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/State";
import { AlbumCard } from "@/features/albums/AlbumCard";
import { SongList } from "@/features/songs/SongList";
import { searchLibrary } from "@/data/library";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";

export function SearchView() {
  const keyword = useUiStore((state) => state.searchKeyword);
  const setKeyword = useUiStore((state) => state.setSearchKeyword);
  const navigate = useUiStore((state) => state.navigate);
  const songs = useLibraryStore((state) => state.songs);
  const albums = useLibraryStore((state) => state.albums);
  const albumById = useLibraryStore((state) => state.albumById);
  const inputRef = useRef<HTMLInputElement>(null);

  const [albumsOpen, setAlbumsOpen] = useState(true);
  const [songsOpen, setSongsOpen] = useState(true);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(
    () => searchLibrary(songs, albums, albumById, keyword),
    [songs, albums, albumById, keyword],
  );

  const matchedSongs = useMemo(
    () => results.groups.flatMap((group) => group.songs),
    [results.groups],
  );

  const trimmed = keyword.trim();
  const hasResults = results.albums.length > 0 || matchedSongs.length > 0;

  return (
    <div className="view view-fill">
      <header className="search-header">
        <label className="search-field">
          <SearchX size={18} className="search-field-icon" />
          <input
            ref={inputRef}
            value={keyword}
            placeholder="搜索歌曲、专辑或艺人"
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
      </header>

      {!trimmed ? (
        <div className="search-body">
          <EmptyState
            icon={<Sparkles size={26} />}
            title="想听点什么？"
            description="输入关键字，搜索塞壬唱片里的歌曲、专辑或艺人。"
          />
        </div>
      ) : !hasResults ? (
        <div className="search-body">
          <EmptyState
            icon={<SearchX size={26} />}
            title={`没有找到「${trimmed}」`}
            description="试试更短的关键字，或换一个写法。"
          />
        </div>
      ) : (
        <>
          {results.albums.length > 0 ? (
            <section className={`search-albums${albumsOpen ? "" : " is-collapsed"}`}>
              <button
                type="button"
                className="search-section-toggle"
                aria-expanded={albumsOpen}
                onClick={() => setAlbumsOpen((value) => !value)}
              >
                <ChevronDown size={16} className="search-section-chevron" />
                <span className="section-title">专辑（{results.albums.length}）</span>
              </button>
              {albumsOpen ? (
                <div className="search-album-row">
                  {results.albums.map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      onOpen={() => navigate({ name: "album", id: album.id })}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {matchedSongs.length > 0 ? (
            <div className={`search-songs${songsOpen ? "" : " is-collapsed"}`}>
              <div className="search-songs-head">
                <button
                  type="button"
                  className="search-section-toggle"
                  aria-expanded={songsOpen}
                  onClick={() => setSongsOpen((value) => !value)}
                >
                  <ChevronDown size={16} className="search-section-chevron" />
                  <span className="section-title">歌曲（{matchedSongs.length}）</span>
                </button>
              </div>
              {songsOpen ? (
                <SongList songs={matchedSongs} albumIndex={albumById} showAlbum />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
