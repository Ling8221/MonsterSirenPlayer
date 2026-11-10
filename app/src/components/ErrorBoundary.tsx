import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** 兜底错误边界：任何渲染异常都给出可恢复界面，而不是整屏白掉。 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ui] 未捕获的渲染错误", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="state-block state-error" style={{ height: "100vh" }}>
        <p className="state-title">界面出错了</p>
        <p className="state-desc">{error.message || String(error)}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          重新加载
        </button>
      </div>
    );
  }
}
