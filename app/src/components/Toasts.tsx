import { useToastStore } from "@/store/useToastStore";

export function Toasts() {
  const items = useToastStore((state) => state.items);
  if (items.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast toast-${item.tone}`}>
          {item.message}
        </div>
      ))}
    </div>
  );
}
