import { describe, expect, it } from "vitest";
import { activeLineIndex, parseLrc } from "@/lib/lrc";

describe("parseLrc", () => {
  it("解析基本时间戳", () => {
    const doc = parseLrc("[00:12.34]第一句\n[01:02.50]第二句");
    expect(doc.lines).toEqual([
      { time: 12.34, text: "第一句" },
      { time: 62.5, text: "第二句" },
    ]);
  });

  it("支持冒号写法与一位小数", () => {
    const doc = parseLrc("[00:05:5]甲\n[00:06:25]乙");
    expect(doc.lines[0]?.time).toBeCloseTo(5.5);
    expect(doc.lines[1]?.time).toBeCloseTo(6.25);
  });

  it("一行多个时间戳会展开成多行", () => {
    const doc = parseLrc("[00:01.00][00:03.00]重复");
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines.map((line) => line.time)).toEqual([1, 3]);
  });

  it("忽略元数据行并读取 offset", () => {
    const doc = parseLrc("[ti:歌名]\n[ar:歌手]\n[offset:-500]\n[00:10.00]正文");
    expect(doc.lines).toHaveLength(1);
    expect(doc.offsetMs).toBe(-500);
    expect(doc.lines[0]?.time).toBe(9.5);
  });

  it("offset 为正时整体延后", () => {
    const doc = parseLrc("[offset:250]\n[00:10.00]正文");
    expect(doc.lines[0]?.time).toBe(10.25);
  });

  it("去掉逐字时间标签", () => {
    const doc = parseLrc("[00:10.00]<00:10.00>你<00:10.50>好");
    expect(doc.lines[0]?.text).toBe("你好");
  });

  it("空行与纯时间戳行被忽略", () => {
    const doc = parseLrc("[00:10.00]\n\n[00:11.00]有内容");
    expect(doc.lines).toHaveLength(1);
  });

  it("没有时间戳时退化为纯文本", () => {
    const doc = parseLrc("这是一段没有时间轴的歌词\n第二行");
    expect(doc.lines).toHaveLength(0);
    expect(doc.plain).toContain("没有时间轴");
  });

  it("空字符串返回空文档", () => {
    const doc = parseLrc("   ");
    expect(doc.lines).toHaveLength(0);
    expect(doc.plain).toBeNull();
  });

  it("乱序时间戳会重新排序", () => {
    const doc = parseLrc("[00:20.00]后\n[00:10.00]前");
    expect(doc.lines.map((line) => line.text)).toEqual(["前", "后"]);
  });
});

describe("activeLineIndex", () => {
  const lines = [
    { time: 1, text: "a" },
    { time: 5, text: "b" },
    { time: 9, text: "c" },
  ];

  it("还没到第一句返回 -1", () => {
    expect(activeLineIndex(lines, 0.5)).toBe(-1);
  });

  it("正好等于时间点时命中该句", () => {
    expect(activeLineIndex(lines, 5)).toBe(1);
  });

  it("落在两句之间命中前一句", () => {
    expect(activeLineIndex(lines, 8.9)).toBe(1);
  });

  it("超过最后一句命中最后一句", () => {
    expect(activeLineIndex(lines, 100)).toBe(2);
  });

  it("空歌词返回 -1", () => {
    expect(activeLineIndex([], 10)).toBe(-1);
  });
});
