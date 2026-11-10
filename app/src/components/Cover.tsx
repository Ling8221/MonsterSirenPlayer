import { useEffect, useState } from "react";
import { initialOf } from "@/lib/format";
import { peekCoverFallback, resolveCoverFallback } from "@/lib/cover";

interface CoverProps {
  src?: string | null;
  name: string;
  className?: string;
  /** 大图优先解码，列表图懒加载 */
  eager?: boolean;
}

/**
 * 封面图：正常直接加载 CDN 图；失败时先让 Rust 带 Referer 重试一次，
 * 再失败就退化成「首字 + 渐变」占位，避免出现浏览器破图标。
 */
export function Cover({ src, name, className = "", eager = false }: CoverProps) {
  const url = (src ?? "").trim();
  const [override, setOverride] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setOverride(null);
    setBroken(false);
  }, [url]);

  const shown = override ?? (broken ? null : url || null);

  const handleError = (): void => {
    if (override) {
      setOverride(null);
      setBroken(true);
      return;
    }
    setBroken(true);
    if (!url) return;
    const cached = peekCoverFallback(url);
    if (cached) {
      setOverride(cached);
      return;
    }
    void resolveCoverFallback(url).then((dataUrl) => {
      if (dataUrl) setOverride(dataUrl);
    });
  };

  return (
    <div className={`cover ${className}`.trim()} data-empty={shown ? undefined : "true"}>
      {shown ? (
        <img
          src={shown}
          alt={name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={handleError}
        />
      ) : (
        <span className="cover-fallback" aria-hidden="true">
          {initialOf(name)}
        </span>
      )}
    </div>
  );
}
