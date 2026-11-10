/** 主题色 / 字体的纯函数与 DOM 应用逻辑。 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const DEFAULT_THEME_COLOR = "#18d1ff";

export function parseHexColor(input: string): Rgb | null {
  const text = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(text)) {
    const r = parseInt(text[0]! + text[0]!, 16);
    const g = parseInt(text[1]! + text[1]!, 16);
    const b = parseInt(text[2]! + text[2]!, 16);
    return { r, g, b };
  }
  if (/^[0-9a-f]{6}$/i.test(text)) {
    const r = parseInt(text.slice(0, 2), 16);
    const g = parseInt(text.slice(2, 4), 16);
    const b = parseInt(text.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

export function toHex(color: Rgb): string {
  const part = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${part(color.r)}${part(color.g)}${part(color.b)}`;
}

/** factor < 1 变暗；> 1 朝白色提亮。 */
export function shade(color: Rgb, factor: number): Rgb {
  if (factor <= 1) {
    return { r: color.r * factor, g: color.g * factor, b: color.b * factor };
  }
  const t = Math.min(factor - 1, 1);
  return {
    r: color.r + (255 - color.r) * t,
    g: color.g + (255 - color.g) * t,
    b: color.b + (255 - color.b) * t,
  };
}

export function accentVariables(input: string): Record<string, string> {
  const rgb = parseHexColor(input) ?? parseHexColor(DEFAULT_THEME_COLOR)!;
  const strong = shade(rgb, 0.82);
  return {
    "--accent": toHex(rgb),
    "--accent-strong": toHex(strong),
    "--accent-rgb": `${rgb.r}, ${rgb.g}, ${rgb.b}`,
  };
}

export interface ThemePreset {
  name: string;
  value: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: "塞壬蓝", value: "#18d1ff" },
  { name: "紫罗兰", value: "#a78bfa" },
  { name: "樱粉", value: "#f472b6" },
  { name: "薄荷绿", value: "#34d399" },
  { name: "落日橙", value: "#fb923c" },
  { name: "珊瑚红", value: "#f87171" },
  { name: "琥珀金", value: "#fbbf24" },
];

/** 内置可变字体；字体设置为空字符串时使用它。 */
export const DEFAULT_FONT_FAMILY = "";
export const DEFAULT_FONT_LABEL = "MiSans VF";

const FALLBACK_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif';

/** 旧版本存的是预设 id，这里映射到系统字体名。 */
const LEGACY_FONT_IDS: Record<string, string> = {
  misans: DEFAULT_FONT_FAMILY,
  system: DEFAULT_FONT_FAMILY,
  yahei: "Microsoft YaHei",
  serif: "SimSun",
};

export function normalizeFontFamily(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_FONT_FAMILY;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_FONT_FAMILY;
  // 内置字体与系统同名时统一存成空字符串，保证始终优先用打包的 MiSans VF。
  if (trimmed.toLowerCase() === DEFAULT_FONT_LABEL.toLowerCase()) return DEFAULT_FONT_FAMILY;
  if (trimmed in LEGACY_FONT_IDS) return LEGACY_FONT_IDS[trimmed]!;
  return trimmed;
}

export function fontDisplayName(family: string): string {
  return family.trim() || DEFAULT_FONT_LABEL;
}

/** 生成 CSS font-family：用户选择的字体在前，内置 MiSans VF 作为兜底。 */
export function fontStackFor(family: string): string {
  const selected = normalizeFontFamily(family);
  const miSans = '"MiSans VF"';
  if (!selected) return `${miSans}, ${FALLBACK_STACK}`;
  const quoted = `"${selected.replace(/"/g, "")}"`;
  return `${quoted}, ${miSans}, ${FALLBACK_STACK}`;
}

export const LOG_MIN_KB = 64;
export const LOG_MAX_KB = 10240;
export const DEFAULT_LOG_KB = 512;

export function clampLogKb(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LOG_KB;
  return Math.min(LOG_MAX_KB, Math.max(LOG_MIN_KB, Math.round(value)));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function applyThemeColor(value: string): void {
  if (typeof document === "undefined") return;
  const variables = accentVariables(value);
  const root = document.documentElement;
  for (const [name, content] of Object.entries(variables)) {
    root.style.setProperty(name, content);
  }
}

export function applyFont(family: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--font-sans", fontStackFor(family));
}

export type ThemeMode = "dark" | "light" | "system";

export const DEFAULT_THEME_MODE: ThemeMode = "dark";
export const UI_SCALE_MIN = 0.75;
export const UI_SCALE_MAX = 1.5;
export const DEFAULT_UI_SCALE = 1;

let activeThemeMode: ThemeMode = DEFAULT_THEME_MODE;
let systemThemeBound = false;

function systemPrefersLight(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function resolveThemeMode(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") return systemPrefersLight() ? "light" : "dark";
  return mode;
}

export function applyThemeMode(mode: ThemeMode): void {
  activeThemeMode = mode;
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveThemeMode(mode);

  if (!systemThemeBound && typeof window !== "undefined" && typeof window.matchMedia === "function") {
    systemThemeBound = true;
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
      if (activeThemeMode === "system") {
        document.documentElement.dataset.theme = resolveThemeMode("system");
      }
    });
  }
}

export function clampUiScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_UI_SCALE;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(value * 100) / 100));
}

export function applyUiScale(scale: number): void {
  if (typeof document === "undefined") return;
  const value = clampUiScale(scale);
  document.documentElement.style.setProperty("zoom", String(value));
  document.documentElement.style.setProperty("--ui-scale", String(value));
}
