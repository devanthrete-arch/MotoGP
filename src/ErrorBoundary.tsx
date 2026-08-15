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
      <main className="min-h-screen bg-background text-on-surface flex items-start justify-center px-4 py-16">
        <section
          className="w-full max-w-xl flex flex-col items-start gap-4 bg-surface-container border border-outline-variant rounded-lg p-6"
          role="alert"
        >
          <p className="label-caps text-primary">Recovery mode</p>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-tight text-on-surface">
            Autoflex hit a rough patch.
          </h1>
          <p className="text-sm text-on-surface-variant">
            Your local garage data should still be safe. Try reloading the app. If this keeps happening, share the
            message below with the Autoflex team.
          </p>
          <code className="w-full font-mono text-xs text-error bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 break-words">
            {this.state.error.message || "Unknown interface error"}
          </code>
          <div className="flex flex-wrap gap-3 mt-1">
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
