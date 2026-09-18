"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { useRequiredRole } from "./RoleContext";
import { ROLE_LABEL } from "@/lib/role";

export function AccountMenu() {
  const { role, logOut } = useRequiredRole();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function handleLogOut() {
    setOpen(false);
    logOut();
    router.push("/login");
  }

  return (
    <div ref={containerRef} className="relative border-t border-slate-200 p-3">
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          <button
            type="button"
            onClick={handleLogOut}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-slate-50"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
          {role === "manager" ? "MG" : "CW"}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-xs font-medium text-slate-900">{ROLE_LABEL[role]}</div>
          <div className="text-[10px] text-slate-400">Viewing as</div>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
    </div>
  );
}
