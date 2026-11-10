import { useEffect } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { useWindowStore } from "@/store/useWindowStore";

interface WindowControlsProps {
  className?: string;
}

/** 窗口控制：最小化 / 最大化（还原）/ 关闭。 */
export function WindowControls({ className = "" }: WindowControlsProps) {
  const init = useWindowStore((state) => state.init);
  const supported = useWindowStore((state) => state.supported);
  const maximized = useWindowStore((state) => state.maximized);
  const minimize = useWindowStore((state) => state.minimize);
  const toggleMaximize = useWindowStore((state) => state.toggleMaximize);
  const close = useWindowStore((state) => state.close);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div
      className={`window-controls ${className}`.trim()}
      role="group"
      aria-label="窗口控制"
      title={supported ? undefined : "浏览器预览中不可用"}
    >
      <button
        type="button"
        className="window-btn window-btn-min"
        title="最小化"
        aria-label="最小化"
        disabled={!supported}
        onClick={minimize}
      >
        <Minus size={15} />
      </button>
      <button
        type="button"
        className="window-btn window-btn-max"
        title={maximized ? "还原" : "最大化"}
        aria-label={maximized ? "还原" : "最大化"}
        disabled={!supported}
        onClick={toggleMaximize}
      >
        {maximized ? <Copy size={13} /> : <Square size={13} />}
      </button>
      <button
        type="button"
        className="window-btn window-btn-close"
        title="关闭"
        aria-label="关闭"
        disabled={!supported}
        onClick={close}
      >
        <X size={16} />
      </button>
    </div>
  );
}
