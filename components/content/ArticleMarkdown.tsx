import type { ReactNode } from "react";
import type { SourceCitation } from "@/lib/types";

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "italic"; text: string }
  | { type: "p"; text: string };

function parseMarkdown(source: string): Block[] {
  const lines = source.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      i++;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^-\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const italicOnly = line.trim().match(/^_(.+)_$/);
    if (italicOnly) {
      blocks.push({ type: "italic", text: italicOnly[1] });
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^-\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^_(.+)_$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", text: paraLines.join(" ") });
  }

  return blocks;
}

const INLINE_REGEX = /\*\*([^*]+)\*\*|\[\^(\d+)\]|\[([^\]]+)\]\(([^)]+)\)/g;

function renderInline(text: string, sources: SourceCitation[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  INLINE_REGEX.lastIndex = 0;

  while ((match = INLINE_REGEX.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    if (match[1] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-slate-900">
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined) {
      const idx = Number(match[2]);
      const source = sources.find((s) => s.index === idx);
      nodes.push(
        <a
          key={key++}
          href={`#source-${idx}`}
          title={source ? source.title : `Source ${idx}`}
          className="mx-0.5 inline-flex -translate-y-1.5 items-center rounded bg-indigo-50 px-1 text-[10px] font-semibold text-indigo-700 no-underline ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100"
        >
          {idx}
        </a>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <a
          key={key++}
          href={match[4]}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900"
        >
          {match[3]}
        </a>,
      );
    }

    lastIndex = INLINE_REGEX.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function ArticleMarkdown({ body, sources }: { body: string; sources: SourceCitation[] }) {
  const blocks = parseMarkdown(body);

  return (
    <div className="max-w-none font-serif text-[15.5px] leading-7 text-slate-800">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          if (block.level === 1) {
            return (
              <h2 key={i} className="mb-3 mt-8 font-sans text-xl font-semibold tracking-tight text-slate-900 first:mt-0">
                {renderInline(block.text, sources)}
              </h2>
            );
          }
          if (block.level === 2) {
            return (
              <h3 key={i} className="mb-3 mt-8 font-sans text-lg font-semibold tracking-tight text-slate-900 first:mt-0">
                {renderInline(block.text, sources)}
              </h3>
            );
          }
          return (
            <h4 key={i} className="mb-2 mt-6 font-sans text-base font-semibold text-slate-900">
              {renderInline(block.text, sources)}
            </h4>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={i} className="mb-4 ml-5 list-disc space-y-1.5 marker:text-slate-400">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, sources)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={i} className="mb-4 ml-5 list-decimal space-y-1.5 marker:text-slate-400">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, sources)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "italic") {
          return (
            <p key={i} className="mb-4 font-sans text-sm italic text-slate-500">
              {renderInline(block.text, sources)}
            </p>
          );
        }

        return (
          <p key={i} className="mb-4">
            {renderInline(block.text, sources)}
          </p>
        );
      })}
    </div>
  );
}
