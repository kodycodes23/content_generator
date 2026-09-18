import type { ReactNode } from "react";

// AI-generated drafts sometimes leave behind citation markers like "[1]" or "[2], [3]"
// that were meant to link to a source but never became real links — strip them rather
// than show dead bracketed numbers. Left untouched if immediately followed by "(", so a
// genuine numbered markdown link (rare, but possible) survives.
function stripCitationMarkers(text: string): string {
  return text
    .replace(/\[\d+(?:\s*,\s*\d+)*\](?!\()/g, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

function normalizeHeading(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string };

function parseBlocks(source: string): Block[] {
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

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
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

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", text: paraLines.join(" ") });
  }

  return blocks;
}

const INLINE_REGEX = /\*\*([^*]+)\*\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\)/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  INLINE_REGEX.lastIndex = 0;

  while ((match = INLINE_REGEX.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    if (match[1] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-foreground">
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined) {
      nodes.push(
        <em key={key++} className="italic">
          {match[2]}
        </em>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <a
          key={key++}
          href={match[4]}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-800"
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

export function SimpleMarkdown({
  text,
  className = "",
  skipLeadingHeadingIfMatches,
}: {
  text: string;
  className?: string;
  // When the body's own first line duplicates a title already shown elsewhere on the page
  // (common in AI-generated drafts that open with "# Title"), pass that title here to drop
  // the redundant heading instead of showing it twice.
  skipLeadingHeadingIfMatches?: string;
}) {
  const blocks = parseBlocks(stripCitationMarkers(text));

  if (
    skipLeadingHeadingIfMatches &&
    blocks.length > 0 &&
    blocks[0].type === "heading" &&
    normalizeHeading(blocks[0].text) === normalizeHeading(skipLeadingHeadingIfMatches)
  ) {
    blocks.shift();
  }

  return (
    <div className={`space-y-3 text-sm leading-relaxed text-foreground/90 ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const sizes = { 1: "text-xl font-semibold", 2: "text-lg font-semibold", 3: "text-base font-semibold" } as const;
          return (
            <p key={i} className={`${sizes[block.level]} mt-5 text-foreground first:mt-0`}>
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="ml-5 list-disc space-y-1 marker:text-muted-foreground">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={i} className="ml-5 list-decimal space-y-1 marker:text-muted-foreground">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        return <p key={i}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}
