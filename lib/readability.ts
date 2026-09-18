function countSyllables(word: string): number {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.length === 0) return 0;
  if (normalized.length <= 3) return 1;
  const withoutTrailingE = normalized.replace(/(?:[^laeiouy]e|ed|es)$/, "");
  const matches = withoutTrailingE.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(matches.length, 1) : 1;
}

export interface TextStats {
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
  readingEase: number;
  readingLabel: string;
}

export function analyzeText(markdown: string): TextStats {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[\^\d+\]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`]/g, " ")
    .trim();

  const words = plain.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const sentenceMatches = plain.match(/[^.!?]+[.!?]+/g);
  const sentenceCount = sentenceMatches ? sentenceMatches.length : Math.max(1, Math.round(wordCount / 18));

  const syllableCount = words.reduce((total, word) => total + countSyllables(word), 0);

  if (wordCount === 0) {
    return { wordCount: 0, sentenceCount: 0, syllableCount: 0, readingEase: 0, readingLabel: "No content" };
  }

  const rawScore =
    206.835 - 1.015 * (wordCount / Math.max(sentenceCount, 1)) - 84.6 * (syllableCount / wordCount);
  const readingEase = Math.max(0, Math.min(100, Math.round(rawScore)));

  let readingLabel = "Very Difficult";
  if (readingEase >= 90) readingLabel = "Very Easy";
  else if (readingEase >= 80) readingLabel = "Easy";
  else if (readingEase >= 70) readingLabel = "Fairly Easy";
  else if (readingEase >= 60) readingLabel = "Standard";
  else if (readingEase >= 50) readingLabel = "Fairly Difficult";
  else if (readingEase >= 30) readingLabel = "Difficult";

  return { wordCount, sentenceCount, syllableCount, readingEase, readingLabel };
}
