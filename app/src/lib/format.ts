/** 纯函数：把秒格式化成 m:ss。 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function cleanArtists(list: readonly string[] | null | undefined): string[] {
  if (!list) return [];
  return list.map((item) => item.trim()).filter(Boolean);
}

/** 接口在不同地方使用 artists / artistes，这里统一并去掉空白项。 */
export function pickArtists(
  primary: readonly string[] | null | undefined,
  fallback?: readonly string[] | null,
): string[] {
  const cleaned = cleanArtists(primary);
  if (cleaned.length > 0) return cleaned;
  return cleanArtists(fallback);
}

export function joinArtists(artists: readonly string[]): string {
  return artists.length > 0 ? artists.join(" / ") : "塞壬唱片-MSR";
}

/** 接口里个别名字带前导空格，统一去掉首尾空白。 */
export function cleanName(name: string | null | undefined): string {
  return (name ?? "").trim();
}

/** 搜索用的规范化：小写 + 去掉多余空白。 */
export function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function includesKeyword(haystack: string, keyword: string): boolean {
  return normalizeForSearch(haystack).includes(keyword);
}

/** 取第一个非空字符作为封面占位。 */
export function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? Array.from(trimmed)[0]! : "?";
}
