import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Autoflex UI crashed", { error, errorInfo });
  }

  private recover = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-shell">
        <section className="crash-panel" role="alert">
          <p className="eyebrow">Recovery mode</p>
          <h1>Autoflex hit a rough patch.</h1>
          <p>
            Your local garage data should still be safe. Try reloading the app. If this keeps happening, share the
            message below with the Autoflex team.
          </p>
          <code>{this.state.error.message || "Unknown interface error"}</code>
          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={this.recover}>
              Try again
            </button>
            <button className="secondary-action" type="button" onClick={() => window.location.reload()}>
              Reload app
            </button>
          </div>
        </section>
      </main>
    );
  }
}
