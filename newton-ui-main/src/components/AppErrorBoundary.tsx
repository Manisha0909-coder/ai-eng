import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort error boundary around the whole app. Without it, any uncaught
 * render error unmounts the React tree and leaves a blank page; this shows a
 * recoverable card instead. Styled with plain CSS variables (no Tailwind)
 * so it still renders even if the styling pipeline is part of the failure.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "rgb(var(--color-background, 15 18 22))",
          color: "rgb(var(--color-text, 235 238 241))",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: "24rem", textAlign: "center" }}>
          <p style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong
          </p>
          <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "1.25rem" }}>
            An unexpected error interrupted the app. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "9999px",
              border: "1px solid rgb(var(--color-border, 55 65 81))",
              background: "rgb(var(--color-primary, 99 102 241))",
              color: "white",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
