"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, PenLine, ShieldCheck, User } from "lucide-react";
import { useRole } from "@/components/content/RoleContext";
import { KoyaMark } from "@/components/content/KoyaMark";
import { ROLE_LABEL, type Role } from "@/lib/role";

const ROLE_CARDS: { role: Role; icon: typeof PenLine; description: string }[] = [
  {
    role: "content_writer",
    icon: PenLine,
    description: "Create requests, review drafts, and send them for approval.",
  },
  {
    role: "manager",
    icon: ShieldCheck,
    description: "Review submitted drafts and approve, reject, or send them back for revision.",
  },
];

// Mock credentials, hardcoded — this is still the same dev role simulator underneath (see
// RoleContext), just gated by a login step instead of a bare card click. No real accounts,
// no backend check, nothing to swap out later beyond how the role itself gets determined.
const MOCK_CREDENTIALS: Record<Role, { username: string; password: string }> = {
  manager: { username: "manager", password: "manager123" },
  content_writer: { username: "writer", password: "writer123" },
};

export default function LoginPage() {
  const { setRole } = useRole();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openLoginForm(role: Role) {
    setSelectedRole(role);
    setUsername("");
    setPassword("");
    setError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedRole) return;

    const creds = MOCK_CREDENTIALS[selectedRole];
    const usernameMatches = username.trim().toLowerCase() === creds.username.toLowerCase();
    const passwordMatches = password === creds.password;

    if (!usernameMatches || !passwordMatches) {
      setError("Incorrect username or password.");
      return;
    }

    setRole(selectedRole);
    router.push("/dashboard");
  }

  if (selectedRole) {
    const card = ROLE_CARDS.find((c) => c.role === selectedRole)!;
    const Icon = card.icon;

    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-6 py-16">
        <div className="w-full max-w-sm">
          <button
            type="button"
            onClick={() => setSelectedRole(null)}
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900">Sign in as {ROLE_LABEL[selectedRole]}</h1>
              <p className="text-xs text-slate-500">Enter your credentials to continue.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Username</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                  placeholder="Enter username"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <KoyaMark className="mx-auto mb-3 h-10 w-10" />
          <h1 className="text-lg font-semibold text-slate-900">Koya Content Ops</h1>
          <p className="mt-1 text-sm text-slate-500">Choose how you want to sign in.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ROLE_CARDS.map(({ role, icon: Icon, description }) => (
            <button
              key={role}
              type="button"
              onClick={() => openLoginForm(role)}
              className="group flex flex-col items-start rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-colors hover:border-slate-900"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors group-hover:bg-slate-900 group-hover:text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900">{ROLE_LABEL[role]}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors group-hover:text-slate-900">
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
