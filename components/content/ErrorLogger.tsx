"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/log-client-error";

// Mounted once at the root layout — catches whatever the React tree itself can't: truly
// uncaught exceptions and unhandled promise rejections (e.g. a fire-and-forget fetch that
// throws with nothing awaiting it).
export function ErrorLogger() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      logClientError("window_error", event.error ?? event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    }
    function handleRejection(event: PromiseRejectionEvent) {
      logClientError("unhandled_rejection", event.reason);
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
