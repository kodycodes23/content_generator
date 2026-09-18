"use client";

import { Link2 } from "lucide-react";
import { SimpleMarkdown } from "./SimpleMarkdown";
import type { InternalLink } from "@/lib/content-request";

// A read-only, single-column "here's exactly what this looks like" view for a Manager
// deciding on a submitted_for_approval request — no edit toggle, no autosave, nothing
// clickable except external links. Channel content and the self-evaluation breakdown stay
// in their usual sidebar spot (EvaluationPanel/ChannelPreview) — this only replaces the
// center article column with a non-editable equivalent that also surfaces meta_description.
export function ManagerPreview({
  title,
  metaDescription,
  articleDraft,
  featuredImageUrl,
  internalLinks,
}: {
  title: string;
  metaDescription: string;
  articleDraft: string;
  featuredImageUrl?: string | null;
  internalLinks?: InternalLink[];
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-white scrollbar-thin">
      <div className="mx-auto w-full max-w-2xl px-8 py-8">
        {featuredImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={featuredImageUrl}
            alt=""
            className="mb-6 aspect-[2/1] w-full rounded-lg border border-slate-200 object-cover"
          />
        )}

        <h1 className="mb-2 font-sans text-2xl font-bold tracking-tight text-slate-900">{title}</h1>

        {metaDescription && (
          <p className="mb-6 border-l-2 border-slate-200 pl-3 text-sm italic leading-relaxed text-slate-500">
            {metaDescription}
          </p>
        )}

        {articleDraft.trim() ? (
          <SimpleMarkdown text={articleDraft} skipLeadingHeadingIfMatches={title} />
        ) : (
          <p className="text-sm text-slate-400">No article content yet.</p>
        )}

        {internalLinks && internalLinks.length > 0 && (
          <div className="mt-10 border-t border-slate-200 pt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Related articles</p>
            <ul className="space-y-2">
              {internalLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
