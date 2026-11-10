import { beforeEach, describe, expect, it } from "vitest";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { usePlaylistsStore } from "@/store/usePlaylistsStore";

describe("收藏", () => {
  beforeEach(() => {
    useFavoritesStore.setState({ ids: [], hydrated: true });
  });

  it("收藏与取消收藏", () => {
    const store = useFavoritesStore.getState();
    expect(store.toggle("s1")).toBe(true);
    expect(useFavoritesStore.getState().ids).toEqual(["s1"]);
    expect(useFavoritesStore.getState().has("s1")).toBe(true);

    expect(useFavoritesStore.getState().toggle("s1")).toBe(false);
    expect(useFavoritesStore.getState().ids).toEqual([]);
  });

  it("新收藏排在最前面", () => {
    useFavoritesStore.getState().toggle("a");
    useFavoritesStore.getState().toggle("b");
    expect(useFavoritesStore.getState().ids).toEqual(["b", "a"]);
  });

  it("收藏可以拖拽排序", () => {
    useFavoritesStore.setState({ ids: ["a", "b", "c"] });
    useFavoritesStore.getState().reorder(2, 0);
    expect(useFavoritesStore.getState().ids).toEqual(["c", "a", "b"]);

    useFavoritesStore.getState().reorder(0, 2);
    expect(useFavoritesStore.getState().ids).toEqual(["a", "b", "c"]);

    useFavoritesStore.getState().reorder(5, 0);
    expect(useFavoritesStore.getState().ids).toEqual(["a", "b", "c"]);
  });

  it("重复 add 不会产生重复项", () => {
    useFavoritesStore.getState().add("a");
    useFavoritesStore.getState().add("a");
    expect(useFavoritesStore.getState().ids).toEqual(["a"]);
  });
});

describe("歌单", () => {
  beforeEach(() => {
    usePlaylistsStore.setState({ items: [], hydrated: true });
  });

  it("创建歌单会生成 id 并去重歌曲", () => {
    const playlist = usePlaylistsStore.getState().create("深夜循环", ["a", "a", "b"]);
    expect(playlist.name).toBe("深夜循环");
    expect(playlist.id.length).toBeGreaterThan(0);
    expect(playlist.songIds).toEqual(["a", "b"]);
    expect(usePlaylistsStore.getState().items).toHaveLength(1);
  });

  it("空名字会回退到默认名", () => {
    const playlist = usePlaylistsStore.getState().create("   ");
    expect(playlist.name).toBe("新建歌单");
  });

  it("重复加入歌曲返回 0 且不改变列表", () => {
    const playlist = usePlaylistsStore.getState().create("测试", ["a"]);
    const added = usePlaylistsStore.getState().addSongs(playlist.id, ["a"]);
    expect(added).toBe(0);
    expect(usePlaylistsStore.getState().items[0]?.songIds).toEqual(["a"]);
  });

  it("批量加入只统计新增数量", () => {
    const playlist = usePlaylistsStore.getState().create("测试", ["a"]);
    const added = usePlaylistsStore.getState().addSongs(playlist.id, ["a", "b", "c"]);
    expect(added).toBe(2);
    expect(usePlaylistsStore.getState().items[0]?.songIds).toEqual(["a", "b", "c"]);
  });

  it("重命名与删除", () => {
    const playlist = usePlaylistsStore.getState().create("旧名字", []);
    usePlaylistsStore.getState().rename(playlist.id, "新名字");
    expect(usePlaylistsStore.getState().items[0]?.name).toBe("新名字");

    usePlaylistsStore.getState().remove(playlist.id);
    expect(usePlaylistsStore.getState().items).toHaveLength(0);
  });

  it("空名字不会覆盖原名字", () => {
    const playlist = usePlaylistsStore.getState().create("保留", []);
    usePlaylistsStore.getState().rename(playlist.id, "   ");
    expect(usePlaylistsStore.getState().items[0]?.name).toBe("保留");
  });

  it("移除歌曲", () => {
    const playlist = usePlaylistsStore.getState().create("测试", ["a", "b"]);
    usePlaylistsStore.getState().removeSong(playlist.id, "a");
    expect(usePlaylistsStore.getState().items[0]?.songIds).toEqual(["b"]);
  });

  it("拖动排序", () => {
    const playlist = usePlaylistsStore.getState().create("测试", ["a", "b", "c"]);
    usePlaylistsStore.getState().reorder(playlist.id, 2, 0);
    expect(usePlaylistsStore.getState().items[0]?.songIds).toEqual(["c", "a", "b"]);
  });

  it("越界排序被忽略", () => {
    const playlist = usePlaylistsStore.getState().create("测试", ["a", "b"]);
    usePlaylistsStore.getState().reorder(playlist.id, 5, 0);
    expect(usePlaylistsStore.getState().items[0]?.songIds).toEqual(["a", "b"]);
  });
});
