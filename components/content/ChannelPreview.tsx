"use client";

import { useState } from "react";
import { Check, Copy, Mail, Quote as QuoteIcon } from "lucide-react";
import type { Channel, ChannelVariants } from "@/lib/content-request";

type TabKey = Channel | "quotes";

const TAB_LABEL: Record<TabKey, string> = {
  linkedin: "LinkedIn",
  x: "X / Twitter",
  newsletter: "Newsletter",
  quotes: "Quote Cards",
};

function ChannelIcon({ tab }: { tab: TabKey }) {
  if (tab === "newsletter") return <Mail className="h-3.5 w-3.5" />;
  if (tab === "quotes") return <QuoteIcon className="h-3.5 w-3.5" />;
  if (tab === "linkedin")
    return (
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#0A66C2] text-[8px] font-bold leading-none text-white">
        in
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/x.png" alt="" className="h-3.5 w-3.5 object-contain" />;
}

function EmptyChannel({ label }: { label: string }) {
  return <p className="p-3 text-xs text-slate-400">No {label} generated for this request.</p>;
}

// LinkedIn and X/Twitter aren't wired up to auto-post yet — this is the manual bridge:
// copy the generated content and paste it in directly.
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (permissions, non-secure context) — fail silently.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ChannelPreview({
  channelTargets,
  variants,
}: {
  channelTargets: Channel[];
  variants: ChannelVariants | null;
}) {
  const tabs: TabKey[] = [...channelTargets];
  if (variants?.quote_cards && variants.quote_cards.length > 0) tabs.push("quotes");

  const [active, setActive] = useState<TabKey>(tabs[0] ?? "linkedin");

  if (!variants || tabs.length === 0) {
    return <div className="p-4 text-xs text-slate-400">Channel drafts will appear once generation finishes.</div>;
  }

  const currentTab = tabs.includes(active) ? active : tabs[0];

  return (
    <div className="p-4">
      <div className="inline-flex w-full flex-wrap gap-0.5 rounded-md border border-slate-200 p-0.5 text-xs">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 font-medium transition-colors ${
              currentTab === tab ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ChannelIcon tab={tab} />
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {currentTab === "linkedin" &&
          (variants.linkedin ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex justify-end">
                <CopyButton text={variants.linkedin.post_text} />
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                {variants.linkedin.post_text}
              </p>
            </div>
          ) : (
            <EmptyChannel label="LinkedIn post" />
          ))}

        {currentTab === "x" &&
          (variants.twitter_thread && variants.twitter_thread.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400">{variants.twitter_thread.length} tweets</p>
              {variants.twitter_thread.map((tweet, i) => {
                const length = tweet.length;
                const over = length > 280;
                return (
                  <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-500">
                        {i + 1}/{variants.twitter_thread!.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-medium tabular-nums ${over ? "text-red-600" : "text-slate-400"}`}
                        >
                          {length}/280
                        </span>
                        <CopyButton text={tweet} />
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{tweet}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyChannel label="X / Twitter thread" />
          ))}

        {currentTab === "newsletter" &&
          (variants.newsletter ? (
            <div className="space-y-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-[11px] font-semibold text-slate-500">Subject</p>
                <p className="text-xs text-slate-800">{variants.newsletter.subject_line}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-[11px] font-semibold text-slate-500">Preview text</p>
                <p className="text-xs text-slate-700">{variants.newsletter.preview_text}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-[11px] font-semibold text-slate-500">Body</p>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                  {variants.newsletter.body_markdown}
                </p>
              </div>
            </div>
          ) : (
            <EmptyChannel label="newsletter draft" />
          ))}

        {currentTab === "quotes" &&
          (variants.quote_cards && variants.quote_cards.length > 0 ? (
            <div className="space-y-2">
              {variants.quote_cards.map((quote, i) => (
                <blockquote
                  key={i}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-medium leading-relaxed text-slate-800"
                >
                  {quote}
                </blockquote>
              ))}
            </div>
          ) : (
            <EmptyChannel label="quote cards" />
          ))}
      </div>
    </div>
  );
}
