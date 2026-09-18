import "server-only";
import { diffWords } from "diff";
import type { DiffPart } from "./content-request";

const CONTEXT_WORDS = 6;

export interface DiffSummary {
  parts: DiffPart[];
  changeRatio: number; // 0-1, changed words / max(old word count, new word count)
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Word-level diff between old/new text, shared by anything that needs a compact "what
// actually changed" summary plus a change-proportion figure (e.g. targeted-revise's
// guardrail). Long unchanged runs are trimmed to a few words of context on each side of a
// change so the stored summary stays small — changed runs are always kept in full, with
// `added`/`removed` flags intact for the UI to highlight.
export function summarizeDiff(oldText: string, newText: string): DiffSummary {
  const rawParts = diffWords(oldText, newText);

  let oldWords = 0;
  let newWords = 0;
  let changedWords = 0;
  for (const part of rawParts) {
    const wc = wordCount(part.value);
    if (!part.added) oldWords += wc;
    if (!part.removed) newWords += wc;
    if (part.added || part.removed) changedWords += wc;
  }
  const denom = Math.max(oldWords, newWords);
  const changeRatio = denom > 0 ? changedWords / denom : 0;

  const parts: DiffPart[] = rawParts.map((part, i) => {
    if (part.added || part.removed) {
      return { value: part.value, added: part.added, removed: part.removed };
    }

    const words = part.value.trim().split(/\s+/).filter(Boolean);
    if (words.length <= CONTEXT_WORDS * 2) {
      return { value: part.value };
    }

    const prevChanged = i > 0 && !!(rawParts[i - 1].added || rawParts[i - 1].removed);
    const nextChanged = i < rawParts.length - 1 && !!(rawParts[i + 1].added || rawParts[i + 1].removed);
    const bits: string[] = [];
    if (prevChanged) bits.push(words.slice(0, CONTEXT_WORDS).join(" "));
    if (prevChanged && nextChanged) bits.push("…");
    if (nextChanged) bits.push(words.slice(-CONTEXT_WORDS).join(" "));
    return { value: bits.length > 0 ? ` ${bits.join(" ")} ` : " … " };
  });

  return { parts, changeRatio };
}
