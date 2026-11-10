import { WindowControls } from "@/components/WindowControls";
import { isTauri } from "@/lib/tauri";
import { useWindowStore } from "@/store/useWindowStore";

export function TitleBar() {
  const desktop = isTauri();
  const toggleMaximize = useWindowStore((state) => state.toggleMaximize);

  return (
    <header
      className="titlebar"
      data-tauri-drag-region
      onDoubleClick={(event) => {
        if (!desktop) return;
        if ((event.target as HTMLElement).closest("button")) return;
        toggleMaximize();
      }}
    >
      <div className="titlebar-brand" data-tauri-drag-region>
        <img src="/titlebar-icon.png" alt="" className="titlebar-logo" data-tauri-drag-region />
        <span data-tauri-drag-region>Monster Siren</span>
      </div>

      <div className="titlebar-controls">
        <WindowControls />
      </div>
    </header>
  );
}
