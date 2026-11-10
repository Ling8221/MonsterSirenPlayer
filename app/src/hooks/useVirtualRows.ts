import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface VirtualRange {
  start: number;
  end: number;
}

/**
 * 固定行高的窗口化列表：只渲染可视区附近的几十行。
 * 首页/搜索可能有两三千首歌，整表渲染会让滚动明显掉帧。
 */
export function useVirtualRows(count: number, rowHeight: number, overscan = 6) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState<VirtualRange>({
    start: 0,
    end: Math.min(count, 40),
  });

  const recompute = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const visibleRows = Math.max(1, Math.ceil(element.clientHeight / rowHeight));
    const start = Math.min(
      Math.max(0, Math.floor(element.scrollTop / rowHeight) - overscan),
      Math.max(0, count - 1),
    );
    const end = Math.min(count, start + visibleRows + overscan * 2);
    setRange((previous) =>
      previous.start === start && previous.end === end ? previous : { start, end },
    );
  }, [count, rowHeight, overscan]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.addEventListener("scroll", recompute, { passive: true });
    const observer = new ResizeObserver(recompute);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", recompute);
      observer.disconnect();
    };
  }, [recompute]);

  return { ref, start: range.start, end: range.end };
}
