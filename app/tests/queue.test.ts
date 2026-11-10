import { describe, expect, it } from "vitest";
import {
  appendToQueue,
  applyMode,
  buildQueue,
  clearQueue,
  currentId,
  ensureTrack,
  insertNext,
  moveInQueue,
  nextIndex,
  previousIndex,
  removeAt,
} from "@/lib/queue";

const list = ["a", "b", "c"];

describe("buildQueue", () => {
  it("保持列表顺序并定位起始歌曲", () => {
    const state = buildQueue(list, "b", "list-loop");
    expect(state.queue).toEqual(["a", "b", "c"]);
    expect(state.baseQueue).toEqual(["a", "b", "c"]);
    expect(state.index).toBe(1);
    expect(currentId(state)).toBe("b");
  });

  it("起始歌曲不在列表时补到最前", () => {
    const state = buildQueue(list, "z", "list-loop");
    expect(state.queue[0]).toBe("z");
    expect(state.index).toBe(0);
    expect(state.queue).toHaveLength(4);
  });

  it("去重", () => {
    const state = buildQueue(["a", "a", "b"], "a", "list-loop");
    expect(state.queue).toEqual(["a", "b"]);
  });

  it("随机模式把当前歌曲固定在第一位", () => {
    const state = buildQueue(list, "b", "shuffle", () => 0);
    expect(state.queue[0]).toBe("b");
    expect(new Set(state.queue)).toEqual(new Set(list));
    expect(state.index).toBe(0);
  });
});

describe("nextIndex / previousIndex", () => {
  it("列表循环在末尾回到开头", () => {
    const state = { ...buildQueue(list, "c", "list-loop") };
    expect(nextIndex(state, true)).toBe(0);
  });

  it("单曲播放在自然结束时停止", () => {
    const state = buildQueue(list, "c", "single");
    expect(nextIndex(state, true)).toBeNull();
  });

  it("单曲播放手动切歌仍然循环", () => {
    const state = buildQueue(list, "c", "single");
    expect(nextIndex(state, false)).toBe(0);
  });

  it("单曲循环始终停留在当前行", () => {
    const state = buildQueue(list, "b", "single-loop");
    expect(nextIndex(state, true)).toBe(1);
    expect(nextIndex(state, false)).toBe(1);
  });

  it("空队列没有下一首", () => {
    expect(nextIndex({ queue: [], baseQueue: [], index: -1, mode: "list-loop" }, true)).toBeNull();
  });

  it("上一首在开头时循环到末尾", () => {
    const state = buildQueue(list, "a", "list-loop");
    expect(previousIndex(state)).toBe(2);
  });
});

describe("applyMode", () => {
  it("切到随机时当前歌曲排第一，切回来恢复原顺序", () => {
    const initial = buildQueue(list, "b", "list-loop");
    const shuffled = applyMode(initial, "shuffle", () => 0);
    expect(shuffled.queue[0]).toBe("b");
    expect(shuffled.mode).toBe("shuffle");

    const restored = applyMode(shuffled, "list-loop");
    expect(restored.queue).toEqual(["a", "b", "c"]);
    expect(restored.index).toBe(1);
  });

  it("模式相同直接返回原对象", () => {
    const state = buildQueue(list, "b", "shuffle");
    expect(applyMode(state, "shuffle")).toBe(state);
  });
});

describe("队列编辑", () => {
  it("下一首播放插到当前歌曲之后", () => {
    const state = buildQueue(list, "b", "list-loop");
    const next = insertNext(state, "x");
    expect(next.queue).toEqual(["a", "b", "x", "c"]);
    expect(currentId(next)).toBe("b");
  });

  it("下一首播放会把已在队尾的歌移到前面", () => {
    const state = buildQueue(list, "b", "list-loop");
    const next = insertNext(state, "c");
    expect(next.queue).toEqual(["a", "b", "c"]);
  });

  it("添加到队列追加到末尾", () => {
    const state = buildQueue(list, "a", "list-loop");
    const next = appendToQueue(state, "d");
    expect(next.queue).toEqual(["a", "b", "c", "d"]);
    expect(currentId(next)).toBe("a");
  });

  it("添加到队列时已存在的歌会移到末尾", () => {
    const state = buildQueue(list, "a", "list-loop");
    const next = appendToQueue(state, "b");
    expect(next.queue).toEqual(["a", "c", "b"]);
  });

  it("移除当前歌曲前一位置时索引跟随", () => {
    const state = buildQueue(list, "c", "list-loop");
    const next = removeAt(state, 0);
    expect(next.queue).toEqual(["b", "c"]);
    expect(currentId(next)).toBe("c");
  });

  it("移除当前歌曲后停在同一位置（即下一首）", () => {
    const state = buildQueue(list, "b", "list-loop");
    const next = removeAt(state, 1);
    expect(next.queue).toEqual(["a", "c"]);
    expect(next.index).toBe(1);
    expect(currentId(next)).toBe("c");
  });

  it("移除最后一首时索引回退", () => {
    const state = buildQueue(list, "c", "list-loop");
    const next = removeAt(state, 2);
    expect(next.queue).toEqual(["a", "b"]);
    expect(currentId(next)).toBe("b");
  });

  it("清空队列", () => {
    const state = buildQueue(list, "a", "list-loop");
    expect(clearQueue(state)).toMatchObject({ queue: [], baseQueue: [], index: -1 });
  });

  it("拖动排序后索引仍指向当前歌曲", () => {
    const state = buildQueue(list, "b", "list-loop");
    const next = moveInQueue(state, 1, 2);
    expect(next.queue).toEqual(["a", "c", "b"]);
    expect(currentId(next)).toBe("b");
  });

  it("越界排序不做修改", () => {
    const state = buildQueue(list, "b", "list-loop");
    expect(moveInQueue(state, 5, 0)).toBe(state);
  });

  it("ensureTrack 在缺失时补入队列", () => {
    const state = buildQueue(list, "a", "list-loop");
    const next = ensureTrack(state, "x");
    expect(next.queue).toContain("x");
    expect(currentId(next)).toBe("x");
  });
});
