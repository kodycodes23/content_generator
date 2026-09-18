"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { isRole, type Role } from "@/lib/role";

const STORAGE_KEY = "koya-simulated-role";
const listeners = new Set<() => void>();

function readStoredRole(): Role | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isRole(stored) ? stored : null;
  } catch {
    return null;
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerSnapshot(): Role | null {
  return null;
}

function writeRole(next: Role | null): void {
  try {
    if (next === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // per-browser convenience only — fine if storage is unavailable/blocked
  }
  listeners.forEach((listener) => listener());
}

interface RoleContextValue {
  role: Role | null;
  setRole: (role: Role) => void;
  logOut: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

// The only place that reads/writes the simulated "session." null means logged out — the
// dashboard layout (via RoleGate) redirects to /login whenever this is null. Swapping in
// real auth later means replacing this file's internals, not any call site.
export function RoleProvider({ children }: { children: ReactNode }) {
  const role = useSyncExternalStore(subscribe, readStoredRole, getServerSnapshot);
  const setRole = useCallback((next: Role) => writeRole(next), []);
  const logOut = useCallback(() => writeRole(null), []);

  return <RoleContext.Provider value={{ role, setRole, logOut }}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}

// For components that only ever render once RoleGate has confirmed a role is selected
// (ActionBar, ContentTable, ...) — avoids every one of them re-handling the logged-out
// case for a state that, by construction, can't reach them.
export function useRequiredRole(): { role: Role; setRole: (role: Role) => void; logOut: () => void } {
  const ctx = useRole();
  if (ctx.role === null) {
    throw new Error("useRequiredRole() was called before a role was selected — render this under RoleGate.");
  }
  return { ...ctx, role: ctx.role };
}
