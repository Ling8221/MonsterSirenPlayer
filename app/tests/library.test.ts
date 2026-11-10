import { describe, expect, it } from "vitest";
import type { RawAlbum, RawAlbumDetail, RawSong } from "@/api/types";
import {
  albumCoverage,
  albumNameOf,
  buildIndexes,
  normalizeAlbums,
  normalizeSongs,
  searchLibrary,
} from "@/data/library";

const albums: RawAlbum[] = [
  { cid: "1", name: " 花街迎春 ", coverUrl: "https://x/1.jpg", artistes: ["塞壬唱片-MSR"] },
  { cid: "2", name: "Summer Calling", coverDeUrl: "https://x/2.png", artistes: ["A", "B"] },
];

const details: Record<string, RawAlbumDetail> = {
  "1": {
    cid: "1",
    name: "花街迎春",
    coverUrl: "https://x/1.jpg",
    intro: "春节专辑",
    songs: [
      { cid: "s1", name: "花街迎春", artistes: ["塞壬唱片-MSR"] },
      { cid: "s2", name: "铁花飞", artistes: ["Mili"] },
    ],
  },
};

const songs: RawSong[] = [
  { cid: "s1", name: "花街迎春", albumCid: "1", artists: ["塞壬唱片-MSR"] },
  { cid: "s3", name: "Heavenly Me", artists: ["理名"] },
  { cid: "s3", name: "Heavenly Me (重复)", artists: [] },
];

describe("normalizeAlbums", () => {
  it("去掉名字首尾空白并合并详情", () => {
    const result = normalizeAlbums(albums, details);
    expect(result[0]).toMatchObject({
      id: "1",
      name: "花街迎春",
      intro: "春节专辑",
      songIds: ["s1", "s2"],
    });
  });

  it("coverUrl 缺失时回退到 coverDeUrl", () => {
    const result = normalizeAlbums(albums, details);
    expect(result[1]?.coverUrl).toBe("https://x/2.png");
    expect(result[1]?.artists).toEqual(["A", "B"]);
  });

  it("没有详情时歌曲列表为空", () => {
    const result = normalizeAlbums(albums);
    expect(result[1]?.songIds).toEqual([]);
  });
});

describe("normalizeSongs", () => {
  it("按 id 去重，并保留首次出现的名称", () => {
    const result = normalizeSongs(songs, details);
    const heavenly = result.filter((song) => song.id === "s3");
    expect(heavenly).toHaveLength(1);
    expect(heavenly[0]?.name).toBe("Heavenly Me");
  });

  it("专辑详情可以补全歌曲归属", () => {
    const result = normalizeSongs(songs, details);
    const iron = result.find((song) => song.id === "s2");
    expect(iron?.albumId).toBe("1");
    expect(iron?.artists).toEqual(["Mili"]);
  });

  it("保留接口给出的专辑归属", () => {
    const result = normalizeSongs(songs, {});
    expect(result.find((song) => song.id === "s1")?.albumId).toBe("1");
    expect(result.find((song) => song.id === "s3")?.albumId).toBeNull();
  });

  it("详情里独有的曲目会被补充进来", () => {
    const result = normalizeSongs([], details);
    expect(result.map((song) => song.id)).toEqual(["s1", "s2"]);
  });
});

describe("索引与搜索", () => {
  const normalizedAlbums = normalizeAlbums(albums, details);
  const normalizedSongs = normalizeSongs(songs, details);
  const indexes = buildIndexes(normalizedSongs, normalizedAlbums);

  it("建立歌曲与专辑索引", () => {
    expect(indexes.songById.get("s1")?.name).toBe("花街迎春");
    expect(indexes.songsByAlbum.get("1")?.map((song) => song.id)).toEqual(["s1", "s2"]);
  });

  it("按歌曲名搜索并分组到专辑", () => {
    const result = searchLibrary(normalizedSongs, normalizedAlbums, indexes.albumById, "铁花");
    expect(result.songs).toHaveLength(1);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.album?.name).toBe("花街迎春");
  });

  it("按专辑名搜索会带出整张专辑的匹配歌曲", () => {
    const result = searchLibrary(normalizedSongs, normalizedAlbums, indexes.albumById, "花街");
    expect(result.albums.map((album) => album.id)).toContain("1");
    expect(result.songs.map((song) => song.id)).toEqual(["s1", "s2"]);
  });

  it("按艺人搜索", () => {
    const result = searchLibrary(normalizedSongs, normalizedAlbums, indexes.albumById, "mili");
    expect(result.songs.map((song) => song.id)).toEqual(["s2"]);
  });

  it("空关键字返回空结果", () => {
    const result = searchLibrary(normalizedSongs, normalizedAlbums, indexes.albumById, "   ");
    expect(result.albums).toHaveLength(0);
    expect(result.songs).toHaveLength(0);
  });

  it("没有专辑归属的歌曲放在最后一组", () => {
    const result = searchLibrary(normalizedSongs, normalizedAlbums, indexes.albumById, "heavenly");
    expect(result.groups.at(-1)?.album).toBeNull();
  });

  it("albumNameOf 返回专辑名", () => {
    expect(albumNameOf(normalizedSongs[0], indexes.albumById)).toBe("花街迎春");
  });

  it("albumCoverage 统计归属比例", () => {
    expect(albumCoverage(normalizedSongs)).toBeGreaterThan(0.5);
    expect(albumCoverage([])).toBe(1);
  });
});
