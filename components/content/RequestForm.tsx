"use client";

import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { AlertCircle, CheckCircle2, FileText, Link2, Loader2, Paperclip, Sparkles, Type as TypeIcon, X } from "lucide-react";
import type { Audience, Channel } from "@/lib/types";
import { CHANNEL_LABEL } from "@/lib/format";
import { logClientError } from "@/lib/log-client-error";
import { SimilarTopicDialog, type SimilarMatch } from "./SimilarTopicDialog";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

function isSupportedAttachment(file: File): boolean {
  return ALLOWED_ATTACHMENT_TYPES.includes(file.type);
}

const AUDIENCES: { value: Audience; label: string; description: string }[] = [
  { value: "executive", label: "Executive", description: "Strategic, outcome-focused framing" },
  { value: "practitioner", label: "Practitioner", description: "Tactical, how-to oriented" },
  { value: "technical", label: "Technical", description: "Detail-heavy, precise language" },
];

const CHANNELS: Channel[] = ["linkedin", "x", "newsletter"];

type SourceMode = "none" | "url";

export function RequestForm() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState<Audience>("practitioner");
  const [sourceMode, setSourceMode] = useState<SourceMode>("none");
  const [sourceUrl, setSourceUrl] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [channels, setChannels] = useState<Channel[]>(["linkedin", "newsletter"]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [similarMatches, setSimilarMatches] = useState<SimilarMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  function onAttachmentChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isSupportedAttachment(file)) {
      setError("Attachments must be a PNG, JPG, WEBP, or PDF file.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("Attachment must be 10MB or smaller.");
      return;
    }
    setError(null);
    setAttachment(file);
  }

  function toggleChannel(channel: Channel) {
    setChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));
  }

  function addKeyword(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setKeywords((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setKeywordDraft("");
  }

  function onKeywordKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(keywordDraft);
    } else if (e.key === "Backspace" && keywordDraft === "" && keywords.length > 0) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  }

  function validate(): string | null {
    if (topic.trim().length < 8) return "Add a bit more detail to your topic or thesis (at least 8 characters).";
    if (sourceMode === "url") {
      try {
        new URL(sourceUrl);
      } catch {
        return "Enter a valid, absolute source URL (including https://).";
      }
    }
    if (channels.length === 0) return "Select at least one target channel.";
    return null;
  }

  function resetForm() {
    setSubmittedId(null);
    setTopic("");
    setSourceMode("none");
    setSourceUrl("");
    setAttachment(null);
    setKeywords([]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setCheckingSimilar(true);
    try {
      const res = await fetch("/api/content-requests/check-similar-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.similar) && data.similar.length > 0) {
        setCheckingSimilar(false);
        setSimilarMatches(data.similar);
        return;
      }
    } catch {
      // Advisory only — never blocks submission. Fall through to submitting normally.
    }
    setCheckingSimilar(false);
    await submitRequest();
  }

  async function submitRequest() {
    setError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("topic", topic.trim());
      formData.append("target_audience", audience);
      formData.append("source_url", sourceMode === "url" ? sourceUrl.trim() : "");
      formData.append("primary_keywords", JSON.stringify(keywords));
      formData.append("channel_targets", JSON.stringify(channels));
      if (attachment) formData.append("file", attachment);

      const res = await fetch("/api/content-requests", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        const message = data.error ?? "Something went wrong submitting this request.";
        setError(message);
        logClientError("action_failed", new Error(message), { path: "/api/content-requests", status: res.status });
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      setSubmittedId(data.id);
    } catch (err) {
      setError("Could not reach the server. Check your connection and try again.");
      logClientError("action_failed", err, { path: "/api/content-requests" });
      setSubmitting(false);
    }
  }

  if (submittedId) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">Request submitted</p>
          <p className="mt-1 text-xs text-emerald-700">
            Sent to the automation pipeline as <span className="font-mono">{submittedId}</span>. It&apos;s running
            in n8n now — check the workflow execution log there for progress.
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="mt-2 rounded-md border border-emerald-300 bg-white px-3.5 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <label htmlFor="topic" className="text-sm font-semibold text-slate-900">
          Topic or thesis
        </label>
        <p className="mt-0.5 text-xs text-slate-500">What&apos;s the core idea? A sentence or two is enough to start research.</p>
        <textarea
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={3}
          placeholder="e.g. Why top candidates ghost after the first interview"
          className="mt-3 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <span className="text-sm font-semibold text-slate-900">Target audience</span>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAudience(a.value)}
              className={`rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                audience === a.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="font-medium">{a.label}</div>
              <div className={`mt-0.5 text-xs ${audience === a.value ? "text-slate-300" : "text-slate-500"}`}>
                {a.description}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <span className="text-sm font-semibold text-slate-900">Source material</span>
        <p className="mt-0.5 text-xs text-slate-500">Ground the piece in a source URL, or let research start from the topic alone.</p>

        <div className="mt-3 inline-flex rounded-md border border-slate-200 p-0.5 text-sm">
          {(
            [
              { value: "none" as const, label: "Raw idea only" },
              { value: "url" as const, label: "Source URL" },
            ]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSourceMode(opt.value)}
              className={`rounded px-3 py-1.5 font-medium transition-colors ${
                sourceMode === opt.value ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {sourceMode === "url" && (
          <div className="relative mt-3">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
        )}

        {sourceMode === "none" && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
            <TypeIcon className="h-3.5 w-3.5" />
            Research will run from the topic and keywords alone.
          </div>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <label htmlFor="attachment" className="text-xs font-semibold text-slate-700">
            Supporting attachment (optional)
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Attach a PNG, JPG, WEBP, or PDF alongside — or instead of — a source URL. Up to 10MB.
          </p>

          {attachment ? (
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-xs text-slate-700">
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{attachment.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="shrink-0 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="attachment"
              className="mt-2.5 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Choose a file…
            </label>
          )}
          <input
            id="attachment"
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={onAttachmentChange}
            className="hidden"
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <span className="text-sm font-semibold text-slate-900">Target channels</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHANNELS.map((channel) => (
            <button
              key={channel}
              type="button"
              onClick={() => toggleChannel(channel)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                channels.includes(channel)
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {CHANNEL_LABEL[channel]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <label htmlFor="keywords" className="text-sm font-semibold text-slate-900">
          Primary keywords
        </label>
        <p className="mt-0.5 text-xs text-slate-500">Press Enter or comma to add. The first keyword becomes the primary SEO target.</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 p-2 focus-within:border-slate-400">
          {keywords.map((k, i) => (
            <span
              key={k}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                i === 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {k}
              <button
                type="button"
                onClick={() => setKeywords((prev) => prev.filter((kw) => kw !== k))}
                className="opacity-70 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            id="keywords"
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            onKeyDown={onKeywordKeyDown}
            onBlur={() => addKeyword(keywordDraft)}
            placeholder={keywords.length === 0 ? "candidate experience, time to hire…" : ""}
            className="min-w-[10rem] flex-1 border-0 px-1 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 pb-4">
        <button
          type="submit"
          disabled={submitting || checkingSimilar}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {checkingSimilar ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for similar content…
            </>
          ) : submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting pipeline…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Start Research &amp; Generation
            </>
          )}
        </button>
      </div>

      {similarMatches && (
        <SimilarTopicDialog
          matches={similarMatches}
          onCancel={() => setSimilarMatches(null)}
          onProceed={() => {
            setSimilarMatches(null);
            void submitRequest();
          }}
        />
      )}
    </form>
  );
}
