// Client-safe error reporter — fire-and-forget POST to /api/errors. Never throws: a logger
// that can itself crash the page defeats the point.
import { isRole } from "./role";

const ROLE_STORAGE_KEY = "koya-simulated-role";

export type ClientErrorSource = "window_error" | "unhandled_rejection" | "react_error_boundary" | "action_failed";

export function logClientError(source: ClientErrorSource, error: unknown, context?: Record<string, unknown>): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? null) : null;
    const storedRole = typeof window !== "undefined" ? window.localStorage.getItem(ROLE_STORAGE_KEY) : null;

    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        message,
        stack,
        url: typeof window !== "undefined" ? window.location.href : null,
        role: isRole(storedRole) ? storedRole : null,
        context,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting must never throw back into the caller.
  }
}
