"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useRole } from "./RoleContext";

// Wraps the dashboard: redirects to /login whenever no role is selected (fresh browser,
// or after Log out). By the time this effect runs, useSyncExternalStore has already
// reconciled `role` with the real localStorage value (hydration mismatches are resolved
// during commit, before effects fire), so there's no separate "have we checked yet" state
// to track here.
export function RoleGate({ children }: { children: ReactNode }) {
  const { role } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (role === null) {
      router.replace("/login");
    }
  }, [role, router]);

  if (role === null) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return <>{children}</>;
}
