"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eye, FileEdit, ImagePlus, Link2, Loader2, Pencil } from "lucide-react";
import { SimpleMarkdown } from "./SimpleMarkdown";
import { ImageSearchPanel } from "./ImageSearchPanel";
import { analyzeText } from "@/lib/readability";
import type { InternalLink } from "@/lib/content-request";

type SaveState = "idle" | "saving" | "saved";

export function ArticleCanvas({
  requestId,
  title: initialTitle,
  articleDraft,
  featuredImageUrl: initialFeaturedImageUrl,
  internalLinks,
  editable,
  onSaved,
}: {
  requestId: string;
  title: string;
  articleDraft: string;
  featuredImageUrl?: string | null;
  internalLinks?: InternalLink[];
  editable: boolean;
  onSaved: (fields: { title: string; article_draft: string }) => void;
}) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(articleDraft);
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialFeaturedImageUrl ?? null);
  const [imagePanelOpen, setImagePanelOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stats = analyzeText(body);

  async function persist(nextTitle: string, nextBody: string) {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/content-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle, article_draft: nextBody }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSaveState("saved");
        onSaved({ title: updated.title, article_draft: updated.article_draft });
      } else {
        setSaveState("idle");
      }
    } catch {
      setSaveState("idle");
    }
  }

  function scheduleSave(nextTitle: string, nextBody: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(nextTitle, nextBody), 900);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
        <div className="inline-flex rounded-md border border-slate-200 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors ${
              mode === "preview" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            type="button"
            onClick={() => setMode("edit")}
            disabled={!editable}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              mode === "edit" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <FileEdit className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{stats.wordCount} words</span>
          <span className="h-3 w-px bg-slate-200" />
          <span>
            Reading ease {stats.readingEase} · {stats.readingLabel}
          </span>
          {editable && (
            <>
              <span className="h-3 w-px bg-slate-200" />
              <span className="inline-flex items-center gap-1">
                {saveState === "saving" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving
                  </>
                )}
                {saveState === "saved" && (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" /> Saved
                  </>
                )}
                {saveState === "idle" && "Autosaves as you edit"}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-2xl px-8 py-8">
          {featuredImageUrl ? (
            <div className="group relative mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featuredImageUrl}
                alt=""
                className="aspect-[2/1] w-full rounded-lg border border-slate-200 object-cover"
              />
              <button
                type="button"
                onClick={() => setImagePanelOpen(true)}
                className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-slate-900/70 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-slate-900/85 group-hover:opacity-100"
              >
                <Pencil className="h-3.5 w-3.5" />
                Change Image
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setImagePanelOpen(true)}
              className="mb-6 flex aspect-[2/1] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-600"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-xs font-medium">Add featured image</span>
            </button>
          )}

          {imagePanelOpen && (
            <ImageSearchPanel
              requestId={requestId}
              initialQuery={title}
              onClose={() => setImagePanelOpen(false)}
              onSelected={(url) => {
                setFeaturedImageUrl(url);
                setImagePanelOpen(false);
              }}
            />
          )}

          {mode === "edit" && editable ? (
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                scheduleSave(e.target.value, body);
              }}
              className="mb-4 w-full border-0 p-0 font-sans text-2xl font-bold tracking-tight text-slate-900 focus:outline-none"
            />
          ) : (
            <h1 className="mb-4 font-sans text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          )}

          {mode === "edit" && editable ? (
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                scheduleSave(title, e.target.value);
              }}
              onBlur={() => persist(title, body)}
              rows={28}
              className="w-full resize-none border-0 p-0 font-mono text-[13px] leading-6 text-slate-800 focus:outline-none"
            />
          ) : body.trim() ? (
            <SimpleMarkdown text={body} skipLeadingHeadingIfMatches={title} />
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
    </div>
  );
}
