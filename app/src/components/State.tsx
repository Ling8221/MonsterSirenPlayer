import type { ReactNode } from "react";

export function Spinner({ size = 20 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function LoadingState({ text = "正在加载…" }: { text?: string }) {
  return (
    <div className="state-block">
      <Spinner size={26} />
      <p>{text}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-block state-empty">
      {icon ? <div className="state-icon">{icon}</div> : null}
      <p className="state-title">{title}</p>
      {description ? <p className="state-desc">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-block state-error">
      <p className="state-title">出错了</p>
      <p className="state-desc">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          重试
        </button>
      ) : null}
    </div>
  );
}
