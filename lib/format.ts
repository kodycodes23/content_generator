import type { Channel, ContentStatus } from "./types";

export const STATUS_LABEL: Record<ContentStatus, string> = {
  drafting: "Drafting",
  pending_review: "Pending Review",
  approved: "Approved",
  queued: "Queued",
  published: "Published",
  rejected: "Rejected",
};

export const STATUS_STYLES: Record<ContentStatus, string> = {
  drafting: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  pending_review: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  queued: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
  published: "bg-slate-900 text-white ring-1 ring-inset ring-slate-900",
  rejected: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
};

export const STATUS_DOT: Record<ContentStatus, string> = {
  drafting: "bg-blue-500",
  pending_review: "bg-amber-500",
  approved: "bg-emerald-500",
  queued: "bg-violet-500",
  published: "bg-slate-50",
  rejected: "bg-red-500",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: "LinkedIn",
  x: "X / Twitter",
  newsletter: "Newsletter",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}d ago`;
}

export function scoreTone(score: number): { text: string; ring: string; bg: string } {
  if (score >= 8.5) return { text: "text-emerald-700", ring: "ring-emerald-200", bg: "bg-emerald-50" };
  if (score >= 7) return { text: "text-amber-700", ring: "ring-amber-200", bg: "bg-amber-50" };
  return { text: "text-red-700", ring: "ring-red-200", bg: "bg-red-50" };
}

export function initialsFromEmail(email: string): string {
  const name = email.split("@")[0] ?? email;
  const parts = name.split(/[.\-_]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
