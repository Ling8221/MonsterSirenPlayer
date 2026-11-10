// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  createSectionStorage,
  migrateStorageLayout,
  readJson,
  writeJson,
} from "@/lib/storage";

interface PersistedSection {
  state: Record<string, unknown>;
  version: number;
}

describe("配置存储布局", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("收藏和歌单合并进同一个 library.json", async () => {
    const storage = createSectionStorage("library");
    const favorites: PersistedSection = { state: { ids: ["a"] }, version: 1 };
    const playlists: PersistedSection = { state: { items: [] }, version: 1 };

    await storage.setItem("favorites", JSON.stringify(favorites));
    await storage.setItem("playlists", JSON.stringify(playlists));

    const file = await readJson<Record<string, PersistedSection>>("library");
    expect(file?.favorites?.state.ids).toEqual(["a"]);
    expect(file?.playlists?.state.items).toEqual([]);
    expect(await storage.getItem("favorites")).toBe(JSON.stringify(favorites));
    // 旧文件不应再被写入
    expect(await readJson("favorites")).toBeNull();
  });

  it("旧版分散文件会迁移到三个配置文件", async () => {
    await writeJson("favorites", { state: { ids: ["x"] }, version: 1 });
    await writeJson("playlists", { state: { items: [] }, version: 1 });
    await writeJson("playback", { version: 1, queue: ["x"], index: 0 });
    await writeJson("library-cache", { version: 2, rawSongs: [] });

    await migrateStorageLayout();

    expect(await readJson("library")).toMatchObject({
      favorites: { state: { ids: ["x"] } },
      playlists: { state: { items: [] } },
    });
    expect(await readJson("session")).toMatchObject({ queue: ["x"] });
    expect(await readJson("cache/library")).toMatchObject({ version: 2 });

    expect(await readJson("favorites")).toBeNull();
    expect(await readJson("playlists")).toBeNull();
    expect(await readJson("playback")).toBeNull();
    expect(await readJson("library-cache")).toBeNull();
  });
});
