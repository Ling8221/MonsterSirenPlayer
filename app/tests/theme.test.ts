import { describe, expect, it } from "vitest";
import {
  accentVariables,
  clampLogKb,
  DEFAULT_FONT_LABEL,
  DEFAULT_LOG_KB,
  DEFAULT_THEME_COLOR,
  fontDisplayName,
  fontStackFor,
  formatBytes,
  normalizeFontFamily,
  parseHexColor,
  shade,
  toHex,
} from "@/lib/theme";

describe("主题色解析", () => {
  it("解析 6 位十六进制", () => {
    expect(parseHexColor("#18d1ff")).toEqual({ r: 24, g: 209, b: 255 });
    expect(parseHexColor("18D1FF")).toEqual({ r: 24, g: 209, b: 255 });
  });

  it("解析 3 位缩写", () => {
    expect(parseHexColor("#0af")).toEqual({ r: 0, g: 170, b: 255 });
  });

  it("非法输入返回 null", () => {
    expect(parseHexColor("#12345")).toBeNull();
    expect(parseHexColor("red")).toBeNull();
    expect(parseHexColor("")).toBeNull();
  });

  it("toHex 四舍五入并夹紧范围", () => {
    expect(toHex({ r: 24, g: 209, b: 255 })).toBe("#18d1ff");
    expect(toHex({ r: 300, g: -5, b: 12.6 })).toBe("#ff000d");
  });

  it("shade 变暗与提亮", () => {
    expect(toHex(shade({ r: 0, g: 0, b: 0 }, 0.5))).toBe("#000000");
    expect(toHex(shade({ r: 255, g: 255, b: 255 }, 0.5))).toBe("#808080");
    expect(toHex(shade({ r: 0, g: 0, b: 0 }, 2))).toBe("#ffffff");
  });

  it("accentVariables 生成三个 CSS 变量", () => {
    const vars = accentVariables("#18d1ff");
    expect(vars["--accent"]).toBe("#18d1ff");
    expect(vars["--accent-rgb"]).toBe("24, 209, 255");
    expect(vars["--accent-strong"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("非法颜色回退到默认主题色", () => {
    const vars = accentVariables("not-a-color");
    expect(vars["--accent"]).toBe(parseHexColor(DEFAULT_THEME_COLOR) ? DEFAULT_THEME_COLOR : "");
  });
});

describe("字体", () => {
  it("空字符串表示内置 MiSans VF", () => {
    expect(normalizeFontFamily("")).toBe("");
    expect(normalizeFontFamily("   ")).toBe("");
    expect(fontDisplayName("")).toBe(DEFAULT_FONT_LABEL);
    expect(fontStackFor("")).toContain("MiSans VF");
  });

  it("旧版预设 id 会被映射到系统字体或默认字体", () => {
    expect(normalizeFontFamily("misans")).toBe("");
    expect(normalizeFontFamily("system")).toBe("");
    expect(normalizeFontFamily("yahei")).toBe("Microsoft YaHei");
    expect(normalizeFontFamily("serif")).toBe("SimSun");
  });

  it("其他值原样保留并去掉首尾空白", () => {
    expect(normalizeFontFamily("  Noto Sans SC ")).toBe("Noto Sans SC");
    expect(normalizeFontFamily("Microsoft YaHei")).toBe("Microsoft YaHei");
  });

  it("非字符串回退到默认字体", () => {
    expect(normalizeFontFamily(undefined)).toBe("");
    expect(normalizeFontFamily(42)).toBe("");
  });

  it("字体栈把所选字体放前面，MiSans VF 兜底", () => {
    const stack = fontStackFor("Microsoft YaHei");
    expect(stack.startsWith('"Microsoft YaHei"')).toBe(true);
    expect(stack).toContain("MiSans VF");
  });

  it("字体名里的引号会被清理，避免破坏 CSS", () => {
    expect(fontStackFor('Bad"Font')).toContain('"BadFont"');
  });
});

describe("日志上限", () => {
  it("默认 512 KB", () => {
    expect(DEFAULT_LOG_KB).toBe(512);
  });

  it("夹紧到 64–10240", () => {
    expect(clampLogKb(10)).toBe(64);
    expect(clampLogKb(999999)).toBe(10240);
    expect(clampLogKb(1024.4)).toBe(1024);
  });

  it("非法值回退默认", () => {
    expect(clampLogKb(Number.NaN)).toBe(DEFAULT_LOG_KB);
    expect(clampLogKb(Number.POSITIVE_INFINITY)).toBe(DEFAULT_LOG_KB);
  });
});

describe("formatBytes", () => {
  it("按 B / KB / MB 展示", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.00 MB");
  });

  it("非法值回退 0 B", () => {
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(-1)).toBe("0 B");
  });
});
