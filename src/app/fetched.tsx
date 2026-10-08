// Parts of the app kept in their own files and fetched when needed, and the boundary that keeps
// one that fails from taking the rest of the page down.
import { Component, use } from "react";
import type { ComponentType, ReactNode } from "react";
import { ViewLoadError } from "./Shell";

type Fetched = { preload: () => void; forgetFailure: () => void };
const everyFetchedPart: Fetched[] = [];

/**
 * A component kept in its own file. React.lazy would do, but it remembers a failed download for
 * good and makes a file that has already arrived wait one more turn. This one can be told to
 * forget a failure, so the file is fetched again, and shows a downloaded part with no placeholder.
 */
export function fetchedView<Module, Props extends object = object>(
  load: () => Promise<Module>, pick: (module: Module) => ComponentType<Props>,
) {
  let loaded: ComponentType<Props> | null = null;
  let request: Promise<ComponentType<Props>> | null = null;
  let failure: { error: unknown } | null = null;
  // Where to ask after a failure, when the first address can no longer be used: see freshAddress.
  let retryAddress: string | null = null;
  const start = () => (request ??= (retryAddress ? import(/* @vite-ignore */ retryAddress) as Promise<Module> : load()).then(
    (module) => (loaded = pick(module)),
    (error: unknown) => { failure = { error }; throw error; },
  ));
  const View = (props: Props) => {
    const Loaded = loaded ?? use(start());
    return <Loaded {...props} />;
  };
  const part = Object.assign(View, {
    preload: () => { start().catch(() => { /* Shown only if the part is opened. */ }); },
    forgetFailure: () => {
      if (!failure) return;
      retryAddress = freshAddress(failure.error);
      failure = null;
      request = null;
    },
  });
  everyFetchedPart.push(part);
  return part;
}

// Chromium keeps a failed module download for as long as the page stays open, so asking for the
// same address again fails at once without touching the network. Its error names the address, and
// the same file under an extra query string is a new request. Other browsers simply fetch again.
function freshAddress(error: unknown) {
  const named = /https?:\/\/\S+/.exec(error instanceof Error ? error.message : "")?.[0];
  if (!named) return null;
  try {
    const address = new URL(named);
    if (address.origin !== window.location.origin) return null;
    address.searchParams.set("retry", String(Date.now()));
    return address.href;
  } catch {
    return null;
  }
}

function forgetFailures() {
  for (const part of everyFetchedPart) part.forgetFailure();
}

type ViewBoundaryProps = { resetKey: string; onFail?: () => void; children: ReactNode };
type ViewBoundaryState = { failed: boolean; resetKey: string };

/** Keeps a part that could not be shown from taking the header and navigation down with it. */
export class ViewBoundary extends Component<ViewBoundaryProps, ViewBoundaryState> {
  state = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: ViewBoundaryProps, state: ViewBoundaryState) {
    if (props.resetKey === state.resetKey) return null;
    // Every navigation, a second tap on the same link included, clears the error and lets a file
    // whose download failed be fetched afresh. Runs before the page renders, and doing it twice
    // changes nothing.
    forgetFailures();
    return { failed: false, resetKey: props.resetKey };
  }

  componentDidCatch() {
    this.props.onFail?.();
  }

  retry = () => {
    forgetFailures();
    this.setState({ failed: false });
  };

  render() {
    return this.state.failed ? <ViewLoadError onRetry={this.retry} /> : this.props.children;
  }
}
