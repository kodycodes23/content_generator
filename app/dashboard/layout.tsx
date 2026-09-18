import { Sidebar } from "@/components/content/Sidebar";
import { RoleGate } from "@/components/content/RoleGate";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <RoleGate>
      <div className="flex min-h-screen w-full bg-slate-50">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </RoleGate>
  );
}
