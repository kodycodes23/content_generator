"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, PenSquare, TriangleAlert } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { KoyaMark } from "./KoyaMark";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/dashboard/new", label: "New Request", icon: PenSquare, exact: false },
];

const SYSTEM_NAV_ITEMS = [{ href: "/dashboard/errors", label: "Errors", icon: TriangleAlert, exact: true }];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-5">
        <KoyaMark className="h-6 w-6 shrink-0" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">Koya Content Ops</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Publishing
        </div>
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}

        <div className="px-2 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          System
        </div>
        {SYSTEM_NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <AccountMenu />
    </aside>
  );
}
