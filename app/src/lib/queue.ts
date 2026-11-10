/**
 * 播放队列的纯函数模型。
 *
 * 旧版把 baseQueue / currentQueue / queueIndex 三个值散落在模块作用域里，
 * 每个操作函数都手写一遍增删改，随机播放与手动插队时极易错位。
 * 这里把「队列状态」收成一个不可变对象，所有变换都返回新对象：
 *
 *   queue      实际播放顺序（随机模式下就是打乱后的顺序）
 *   baseQueue  原始顺序（关闭随机时恢复用）
 *   index      当前歌曲在 queue 中的下标，-1 表示空队列
 *   mode       播放模式
 *
 * 约定：queue 与 baseQueue 都保证元素唯一。
 */

export type PlayMode = "single" | "list-loop" | "single-loop" | "shuffle";

export interface QueueState {
  queue: string[];
  baseQueue: string[];
  index: number;
  mode: PlayMode;
}

export const EMPTY_QUEUE: QueueState = {
  queue: [],
  baseQueue: [],
  index: -1,
  mode: "list-loop",
};

export type RandomFn = () => number;

/** Fisher–Yates，可注入随机源以便测试。 */
export function shuffleArray<T>(items: readonly T[], random: RandomFn = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = result[i]!;
    result[i] = result[j]!;
    result[j] = current;
  }
  return result;
}

export function dedupe(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

export function currentId(state: QueueState): string | null {
  if (state.index < 0 || state.index >= state.queue.length) return null;
  return state.queue[state.index] ?? null;
}

/**
 * 以一组歌曲为播放列表开始播放。
 * startId 不在列表里时插到最前面；随机模式下当前歌曲固定在第一首
 * （否则用户点了歌曲却听到别的歌）。
 */
export function buildQueue(
  ids: readonly string[],
  startId: string,
  mode: PlayMode,
  random: RandomFn = Math.random,
): QueueState {
  const base = dedupe(ids);
  if (!base.includes(startId)) base.unshift(startId);

  if (mode === "shuffle") {
    const rest = base.filter((id) => id !== startId);
    return {
      queue: [startId, ...shuffleArray(rest, random)],
      baseQueue: base,
      index: 0,
      mode,
    };
  }

  return {
    queue: base.slice(),
    baseQueue: base,
    index: Math.max(0, base.indexOf(startId)),
    mode,
  };
}

/** 计算下一首的下标；返回 null 表示应当停止播放。 */
export function nextIndex(state: QueueState, auto: boolean): number | null {
  const length = state.queue.length;
  if (length === 0) return null;
  if (state.mode === "single-loop") return state.index < 0 ? 0 : state.index;
  // 「单曲播放」：自然播完后停住，但手动点下一首仍然循环。
  if (state.mode === "single" && auto) return null;

  const next = state.index + 1;
  if (next < length) return next;
  return auto && state.mode === "single" ? null : 0;
}

/** 上一首：手动操作，始终循环。 */
export function previousIndex(state: QueueState): number | null {
  const length = state.queue.length;
  if (length === 0) return null;
  const previous = state.index - 1;
  return previous >= 0 ? previous : length - 1;
}

/** 切换播放模式，并尽量保持当前歌曲不变。 */
export function applyMode(
  state: QueueState,
  mode: PlayMode,
  random: RandomFn = Math.random,
): QueueState {
  if (mode === state.mode) return state;
  const playing = currentId(state);

  if (!playing) {
    return { ...state, mode };
  }

  if (mode === "shuffle") {
    const base = dedupe(state.baseQueue.length > 0 ? state.baseQueue : state.queue);
    if (!base.includes(playing)) base.unshift(playing);
    const rest = base.filter((id) => id !== playing);
    return {
      queue: [playing, ...shuffleArray(rest, random)],
      // 原始顺序必须保持不动，否则关闭随机后顺序会乱。
      baseQueue: base,
      index: 0,
      mode,
    };
  }

  const restored = dedupe(state.baseQueue.length > 0 ? state.baseQueue : state.queue);
  return {
    queue: restored,
    baseQueue: restored,
    index: Math.max(0, restored.indexOf(playing)),
    mode,
  };
}

function withoutId(list: readonly string[], id: string): string[] {
  return list.filter((item) => item !== id);
}

function insertAfter(list: readonly string[], anchor: string | null, id: string): string[] {
  const next = list.slice();
  const at = anchor === null ? -1 : next.indexOf(anchor);
  if (at < 0) {
    next.push(id);
    return next;
  }
  next.splice(at + 1, 0, id);
  return next;
}

/** 「下一首播放」：把歌曲移动/插入到当前歌曲之后。 */
export function insertNext(state: QueueState, id: string): QueueState {
  const playing = currentId(state);
  if (!playing) {
    return { ...state, queue: [id], baseQueue: [id], index: 0 };
  }

  const queue = insertAfter(withoutId(state.queue, id), playing, id);
  const baseQueue = insertAfter(withoutId(state.baseQueue, id), playing, id);
  return {
    ...state,
    queue,
    baseQueue,
    index: queue.indexOf(playing),
  };
}

/** 「添加到播放列表」：追加到末尾。 */
export function appendToQueue(state: QueueState, id: string): QueueState {
  const queue = [...withoutId(state.queue, id), id];
  const baseQueue = [...withoutId(state.baseQueue, id), id];
  return {
    ...state,
    queue,
    baseQueue,
    index: state.index < 0 ? 0 : state.index,
  };
}

export function removeAt(state: QueueState, at: number): QueueState {
  if (at < 0 || at >= state.queue.length) return state;
  const removed = state.queue[at]!;
  const queue = state.queue.filter((_, i) => i !== at);
  const baseQueue = state.baseQueue.filter((id) => id !== removed);

  if (queue.length === 0) {
    return { ...state, queue: [], baseQueue: [], index: -1 };
  }

  let index = state.index;
  if (at < state.index) index -= 1;
  if (index >= queue.length) index = queue.length - 1;
  if (index < 0) index = 0;

  return { ...state, queue, baseQueue, index };
}

/**
 * 拖动排序。随机模式下原始顺序同样按新顺序保存，
 * 这样关闭随机后看到的是用户刚整理过的顺序。
 */
export function moveInQueue(state: QueueState, from: number, to: number): QueueState {
  if (from === to) return state;
  if (from < 0 || from >= state.queue.length) return state;
  if (to < 0 || to >= state.queue.length) return state;

  const playing = currentId(state);
  const queue = state.queue.slice();
  const [moved] = queue.splice(from, 1);
  queue.splice(to, 0, moved!);

  return {
    ...state,
    queue,
    baseQueue: queue.slice(),
    index: playing ? queue.indexOf(playing) : -1,
  };
}

export function clearQueue(state: QueueState): QueueState {
  return { ...state, queue: [], baseQueue: [], index: -1 };
}

/** 队列里没有当前歌曲时（例如恢复持久化状态失败），把它补进去并选中。 */
export function ensureTrack(state: QueueState, id: string): QueueState {
  if (state.queue.includes(id)) {
    return { ...state, index: state.queue.indexOf(id) };
  }
  const next = appendToQueue(state, id);
  return { ...next, index: next.queue.indexOf(id) };
}

export function isEmpty(state: QueueState): boolean {
  return state.queue.length === 0;
}

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  single: "单曲播放",
  "list-loop": "列表循环",
  "single-loop": "单曲循环",
  shuffle: "随机播放",
};

export const PLAY_MODE_ORDER: PlayMode[] = ["single", "list-loop", "single-loop", "shuffle"];
