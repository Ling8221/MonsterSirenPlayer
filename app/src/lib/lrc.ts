/** LRC 歌词解析：支持 [mm:ss.xx] 与 [mm:ss:xx] 两种写法、多时间戳与 offset 标签。 */

export interface LyricLine {
  /** 秒 */
  time: number;
  text: string;
}

export interface LyricsDocument {
  lines: LyricLine[];
  /** 没有时间戳的纯文本歌词 */
  plain: string | null;
  /** 全局偏移（毫秒，来自 [offset:] 标签） */
  offsetMs: number;
}

export const EMPTY_LYRICS: LyricsDocument = { lines: [], plain: null, offsetMs: 0 };

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET_TAG = /\[offset:\s*([+-]?\d+)\s*\]/i;
const INLINE_TIME = /<[^>]*>/g;

function fractionToSeconds(raw: string | undefined): number {
  if (!raw) return 0;
  const padded = raw.padEnd(3, "0").slice(0, 3);
  return Number(padded) / 1000;
}

export function parseLrc(source: string): LyricsDocument {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return EMPTY_LYRICS;

  const offsetMs = Number(OFFSET_TAG.exec(text)?.[1] ?? 0) || 0;
  const lines: LyricLine[] = [];

  for (const rawLine of text.split("\n")) {
    if (!rawLine.trim()) continue;
    // 元数据行 [ti:] [ar:] [al:] [by:]
    if (/^\[(ti|ar|al|by|re|ve|length):/i.test(rawLine.trim())) continue;

    TIME_TAG.lastIndex = 0;
    const stamps: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = TIME_TAG.exec(rawLine)) !== null) {
      const minutes = Number(match[1] ?? 0);
      const seconds = Number(match[2] ?? 0);
      stamps.push(minutes * 60 + seconds + fractionToSeconds(match[3]));
    }
    if (stamps.length === 0) continue;

    const content = rawLine.replace(TIME_TAG, "").replace(INLINE_TIME, "").trim();
    if (!content) continue;

    for (const time of stamps) {
      lines.push({ time, text: content });
    }
  }

  if (lines.length === 0) {
    const plain = text
      .split("\n")
      .filter((line) => !/^\s*\[[^\]]*\]\s*$/.test(line))
      .join("\n")
      .trim();
    return { lines: [], plain: plain || null, offsetMs };
  }

  const shift = offsetMs / 1000;
  const adjusted =
    shift === 0
      ? lines
      : lines.map((line) => ({ ...line, time: Math.max(0, line.time + shift) }));

  adjusted.sort((a, b) => a.time - b.time);
  return { lines: adjusted, plain: null, offsetMs };
}

/** 二分查找当前时间对应的歌词行；返回 -1 表示还没唱到第一句。 */
export function activeLineIndex(lines: readonly LyricLine[], seconds: number): number {
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const line = lines[mid]!;
    if (line.time <= seconds) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}
