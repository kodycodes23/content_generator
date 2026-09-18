"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { logClientError } from "@/lib/log-client-error";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Error boundaries must be class components — there's no hook equivalent for getDerivedStateFromError.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logClientError("react_error_boundary", error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
          <p className="text-sm font-medium text-slate-900">Something went wrong.</p>
          <p className="text-xs text-slate-500">The error has been logged. Try reloading the page.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
