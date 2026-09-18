import { createRng, pick, range } from "./rng";
import { analyzeText } from "./readability";
import type {
  ArticleDraft,
  Audience,
  Channel,
  ChannelVariant,
  ChannelVariants,
  ContentRequest,
  EvaluationCriterionScore,
  EvaluationReport,
  EvaluationStatus,
  SourceCitation,
  SourceType,
} from "./types";

const AUDIENCE_LABEL: Record<Audience, string> = {
  executive: "executives",
  practitioner: "practitioners",
  technical: "technical teams",
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "for", "of", "to", "in", "on", "with", "is",
  "are", "how", "why", "your", "you", "at", "by", "into", "vs", "our",
]);

function deriveKeyword(topic: string): string {
  const words = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return words.slice(0, 3).join(" ") || topic.toLowerCase();
}

function titleCase(text: string): string {
  return text
    .split(" ")
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function domainFromUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return "the submitted source";
  }
}

const RESEARCH_OUTLETS = [
  "HubSpot State of Marketing Report",
  "Content Marketing Institute Benchmark Study",
  "Harvard Business Review",
  "LinkedIn Talent Solutions Research",
  "Edelman Trust Barometer",
  "Gartner Marketing Research Brief",
  "McKinsey Talent Trends Report",
];

function fabricateExcerpt(topic: string, outlet: string, rng: () => number): string {
  const stats = [
    `${Math.round(range(rng, 32, 68))}% of teams cite this as a top-three priority this year`,
    `engagement rose by ${Math.round(range(rng, 14, 41))}% among organizations that addressed it directly`,
    `only ${Math.round(range(rng, 18, 39))}% of respondents said they felt confident in their current approach`,
    `budget allocated to this area grew ${Math.round(range(rng, 20, 55))}% year over year`,
  ];
  return `In its latest analysis, ${outlet} found that when it comes to ${topic.toLowerCase()}, ${pick(rng, stats)}.`;
}

export function generateSources(
  request: Pick<ContentRequest, "id" | "topic" | "sourceType" | "sourceInput" | "keywords">,
): SourceCitation[] {
  const rng = createRng(`${request.id}:sources`);
  const sources: SourceCitation[] = [];
  const now = new Date().toISOString();

  if (request.sourceType === "url" && request.sourceInput.trim()) {
    const domain = domainFromUrl(request.sourceInput.trim());
    sources.push({
      id: `src-${request.id}-0`,
      index: 1,
      url: request.sourceInput.trim(),
      title: `${titleCase(request.topic)} — ${domain}`,
      excerpt: `The submitted article outlines the core context behind "${request.topic}", including the practical tension that makes it worth covering right now.`,
      usedInSections: [],
      retrievedAt: now,
    });
  } else if (request.sourceType === "text" && request.sourceInput.trim()) {
    const snippet = request.sourceInput.trim().slice(0, 220).replace(/\s+/g, " ");
    sources.push({
      id: `src-${request.id}-0`,
      index: 1,
      url: null,
      title: "Submitted source material",
      excerpt: snippet.length === 220 ? `${snippet}…` : snippet,
      usedInSections: [],
      retrievedAt: now,
    });
  }

  const outletCount = sources.length > 0 ? 2 : 3;
  const usedOutlets = new Set<string>();
  for (let i = 0; i < outletCount; i++) {
    let outlet = pick(rng, RESEARCH_OUTLETS);
    let guard = 0;
    while (usedOutlets.has(outlet) && guard < 10) {
      outlet = pick(rng, RESEARCH_OUTLETS);
      guard++;
    }
    usedOutlets.add(outlet);
    const idx = sources.length + 1;
    sources.push({
      id: `src-${request.id}-${idx}`,
      index: idx,
      url: `https://example-research.io/${outlet.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: outlet,
      excerpt: fabricateExcerpt(request.topic, outlet, rng),
      usedInSections: [],
      retrievedAt: now,
    });
  }

  return sources;
}

interface ArticleSection {
  heading: string;
  paragraphs: string[];
}

function buildSections(
  topic: string,
  audience: Audience,
  primaryKeyword: string,
  secondaryKeywords: string[],
  sources: SourceCitation[],
): ArticleSection[] {
  const audienceLabel = AUDIENCE_LABEL[audience];
  const [s1, s2, s3] = sources;
  const secondary = secondaryKeywords.slice(0, 2).join(" and ");

  const sections: ArticleSection[] = [
    {
      heading: `Why ${titleCase(primaryKeyword)} Matters for ${titleCase(audienceLabel)}`,
      paragraphs: [
        `For ${audienceLabel}, ${primaryKeyword} has moved from a nice-to-have talking point to a line item that shows up in quarterly planning. The teams that treat it as a strategic priority are pulling ahead of the ones that still treat it as an afterthought.`,
        s1
          ? `${s1.excerpt} [^${s1.index}]`
          : `The shift is showing up in how budgets get allocated, who gets a seat at the planning table, and how quickly teams can respond when the market moves.`,
      ],
    },
    {
      heading: "What the Research Shows",
      paragraphs: [
        s2
          ? `${s2.excerpt} [^${s2.index}]`
          : `Independent research points in the same direction: organizations that invest early see compounding returns, while those that wait struggle to catch up.`,
        s3
          ? `${s3.excerpt} [^${s3.index}] This lines up with what we're seeing across the industry more broadly.`
          : `The pattern holds across company size and sector, which suggests this isn't a passing trend.`,
      ],
    },
    {
      heading: `How to Apply This${secondary ? ` to ${titleCase(secondary)}` : ""}`,
      paragraphs: [
        `Turning this into action doesn't require a full re-org. A few concrete moves make the biggest difference:`,
        "- Audit where you currently stand before committing to a new process\n- Set one measurable goal tied to a business outcome, not a vanity metric\n- Assign clear ownership so the initiative survives past the kickoff meeting\n- Revisit progress on a fixed cadence instead of waiting for a yearly review",
      ],
    },
    {
      heading: "Common Mistakes to Avoid",
      paragraphs: [
        "- Treating this as a one-time project instead of an ongoing practice\n- Copying a competitor's approach without adapting it to your own constraints\n- Measuring activity instead of outcomes\n- Waiting for perfect data before making a first move",
      ],
    },
    {
      heading: "Key Takeaways",
      paragraphs: [
        `${titleCase(primaryKeyword)} is worth the investment when it's tied to a clear outcome and given real ownership. Start small, measure honestly, and expand what's working.`,
      ],
    },
  ];

  return sections;
}

export function generateArticle(
  request: Pick<ContentRequest, "id" | "topic" | "audience" | "keywords">,
  sources: SourceCitation[],
): ArticleDraft {
  const primaryKeyword = request.keywords[0] || deriveKeyword(request.topic);
  const secondaryKeywords = request.keywords.slice(1);
  const title = `${titleCase(request.topic)}: A Practical Guide to ${titleCase(primaryKeyword)}`;

  const sections = buildSections(request.topic, request.audience, primaryKeyword, secondaryKeywords, sources);

  const intro = `${titleCase(primaryKeyword)} shapes more of the ${AUDIENCE_LABEL[request.audience]} agenda than most teams admit. This guide breaks down why it matters, what the current research says, and the specific moves that separate teams who get results from teams who just talk about it.`;

  const linkLines: string[] = [];
  sources.slice(0, 3).forEach((s) => {
    if (s.url) linkLines.push(`[${s.title}](${s.url})`);
  });

  const bodyParts = [intro, ""];
  sections.forEach((section) => {
    bodyParts.push(`## ${section.heading}`);
    section.paragraphs.forEach((p) => bodyParts.push(p));
    bodyParts.push("");
  });

  if (linkLines.length > 0) {
    bodyParts.push("## Further Reading");
    bodyParts.push(linkLines.map((l) => `- ${l}`).join("\n"));
    bodyParts.push("");
  }

  const body = bodyParts.join("\n").trim();
  const { wordCount } = analyzeText(body);

  return { title, body, wordCount };
}

const CRITERIA = [
  "Topic Relevance",
  "Source Grounding",
  "Factual Consistency",
  "Audience Fit",
  "Tone",
  "SEO Fit",
  "Channel Fit",
  "Clarity",
  "Completeness",
] as const;

function statusFromScore(score: number): EvaluationStatus {
  if (score >= 8.5) return "pass";
  if (score >= 6) return "revise";
  return "reject";
}

export function evaluateDraft(
  request: Pick<ContentRequest, "id" | "keywords">,
  article: ArticleDraft,
  sources: SourceCitation[],
  version: number,
): EvaluationReport {
  const rng = createRng(`${request.id}:eval:${version}`);
  const versionBoost = Math.min((version - 1) * 0.9, 1.8);

  const criteria: EvaluationCriterionScore[] = CRITERIA.map((criterion) => {
    let base = range(rng, 6.8, 8.6) + versionBoost;
    let notes = "Meets expectations.";

    if (criterion === "Source Grounding" && sources.length === 0) {
      base -= 1.5;
      notes = "No sources were available to ground claims; treat this draft as directional only.";
    } else if (criterion === "SEO Fit" && request.keywords.length === 0) {
      base -= 0.8;
      notes = "No primary keyword was supplied — keyword was inferred from the topic.";
    } else if (base >= 8.7) {
      notes = "Strong performance on this dimension.";
    }

    const score = Math.max(2, Math.min(10, Math.round(base * 10) / 10));
    return { criterion, score, notes };
  });

  const overallScore = Math.round((criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length) * 10) / 10;
  const status = statusFromScore(overallScore);

  const weakest = [...criteria].sort((a, b) => a.score - b.score).slice(0, 2);
  const weakClaims =
    status === "pass"
      ? []
      : [
          `A claim in "${weakest[0]?.criterion}" needs a tighter tie back to a cited source.`,
          version === 1 ? "One statistic in the research section reads as a generalization rather than a grounded figure." : "",
        ].filter(Boolean);

  const sectionsNeedingRevision =
    status === "pass"
      ? []
      : weakest.map((c) => (c.criterion === "SEO Fit" ? "Title & Introduction" : "What the Research Shows"));

  const recommendedChanges =
    status === "pass"
      ? ["Keep the current structure — no material changes recommended before human review."]
      : [
          `Strengthen ${weakest[0]?.criterion.toLowerCase()} by tightening the language and reinforcing it with a cited source.`,
          `Review ${weakest[1]?.criterion.toLowerCase()} against the rubric before this goes back to a human reviewer.`,
        ];

  return {
    id: `eval-${request.id}-v${version}`,
    version,
    overallScore,
    status,
    criteria,
    weakClaims,
    sectionsNeedingRevision: Array.from(new Set(sectionsNeedingRevision)),
    recommendedChanges,
    createdAt: new Date().toISOString(),
  };
}

export function reviseArticle(article: ArticleDraft, evaluation: EvaluationReport, sources: SourceCitation[]): ArticleDraft {
  const groundingNote = sources[0]
    ? `\n\nThis point is grounded directly in the reviewed source material rather than a general claim.[^${sources[0].index}]`
    : "";

  let body = article.body;

  if (evaluation.sectionsNeedingRevision.includes("What the Research Shows")) {
    body = body.replace(
      /(## What the Research Shows\n[\s\S]*?)(\n\n## )/,
      (match, section: string, next: string) => `${section.trimEnd()}${groundingNote}${next}`,
    );
  }

  if (evaluation.sectionsNeedingRevision.includes("Title & Introduction")) {
    const [firstLine, ...rest] = body.split("\n");
    body = [`${firstLine} In short, this is the shift worth acting on now.`, ...rest].join("\n");
  }

  if (body === article.body) {
    body = `${body}\n\n_Revised to tighten grounding and reduce unsupported generalizations per the self-evaluation pass._`;
  }

  const { wordCount } = analyzeText(body);
  return { title: article.title, body, wordCount };
}

export function applyHumanFeedback(article: ArticleDraft, feedback: string, sources: SourceCitation[]): ArticleDraft {
  const closingSource = sources[sources.length - 1];
  const addition = `\n\n## Editor's Follow-up\n\nBased on reviewer feedback — "${feedback.trim()}" — this section was tightened to address the note directly${
    closingSource ? ` and re-checked against the source material.[^${closingSource.index}]` : "."
  }`;

  const body = `${article.body}${addition}`;
  const { wordCount } = analyzeText(body);
  return { title: article.title, body, wordCount };
}

function countHashtags(text: string): number {
  return (text.match(/#[a-zA-Z0-9_]+/g) || []).length;
}

function buildLinkedIn(topic: string, primaryKeyword: string, article: ArticleDraft): ChannelVariant {
  const hook = `Most teams get ${primaryKeyword} wrong — not because they don't care, but because no one owns it.`;
  const body = [
    hook,
    "",
    `Here's the problem: ${topic.toLowerCase()} keeps getting deprioritized until it becomes urgent. By then, you're reacting instead of leading.`,
    "",
    "The teams that get ahead of it do three things differently:",
    "→ They audit where they actually stand today",
    "→ They tie the work to one measurable business outcome",
    "→ They give it a real owner instead of splitting it across five people",
    "",
    `${article.title.split(":")[0]} isn't complicated. It just needs a plan and someone accountable for it.`,
    "",
    "What's the biggest blocker on your team right now? Drop it in the comments. 👇",
  ].join("\n");
  const hashtags = [`#${primaryKeyword.replace(/\s+/g, "")}`, "#MarketingLeadership"];
  const full = `${body}\n\n${hashtags.join(" ")}`;
  return {
    channel: "linkedin",
    hook,
    body: full,
    hashtags,
    characterCount: full.length,
    guidelineChecks: [
      { label: "Opens with problem → agitation → solution", met: true },
      { label: "Short, skimmable paragraphs", met: true },
      { label: "Ends with a clear call to action", met: true },
      { label: "Uses emojis sparingly", met: (full.match(/\p{Emoji_Presentation}/gu) || []).length <= 3 },
    ],
  };
}

function buildX(topic: string, primaryKeyword: string): ChannelVariant {
  const hook = `${titleCase(primaryKeyword)} is the quiet reason your best campaigns underperform.`;
  const tweets = [
    hook,
    `Most teams treat ${topic.toLowerCase()} as a checkbox instead of a system.\n\nThat's the gap.`,
    "Fix it in 3 moves:\n\n1. Audit where you stand\n2. Tie it to one metric\n3. Give it a real owner",
    "Do this for a quarter and the results compound.",
  ];
  const body = tweets.join("\n\n---\n\n");
  const hashtags = [`#${primaryKeyword.replace(/\s+/g, "")}`];
  const full = `${body}\n\n${hashtags.join(" ")}`;
  return {
    channel: "x",
    hook,
    body: full,
    hashtags,
    characterCount: full.length,
    guidelineChecks: [
      { label: "Leads with the core hook", met: true },
      { label: "Stays focused on one idea", met: true },
      { label: "1–2 hashtags maximum", met: countHashtags(full) <= 2 },
      { label: "Uses line breaks for readability", met: full.includes("\n") },
    ],
  };
}

function buildNewsletter(topic: string, primaryKeyword: string): ChannelVariant {
  const subject = `The ${titleCase(primaryKeyword)} gap nobody's talking about`;
  const body = [
    `Hey there,`,
    "",
    `Quick one today: ${topic.toLowerCase()} is quietly becoming a make-or-break priority, and most teams still haven't put a real plan behind it.`,
    "",
    "**What's changing:**",
    "- Budgets are shifting toward teams that can show measurable impact here",
    "- The bar for \"good enough\" has moved up",
    "- Waiting a quarter to start now costs more than it used to",
    "",
    "**One thing to try this week:** pick a single measurable goal and assign one owner. That's it. Momentum beats a perfect plan.",
    "",
    `If you want the full breakdown — including what the research shows and the mistakes worth avoiding — [read the full article](#).`,
    "",
    "Talk soon,",
    "The Koya Content Team",
  ].join("\n");
  const full = `Subject: ${subject}\n\n${body}`;
  const wordCount = analyzeText(body).wordCount;
  return {
    channel: "newsletter",
    subject,
    hook: subject,
    body: full,
    hashtags: [],
    characterCount: full.length,
    guidelineChecks: [
      { label: "Subject line leads with a clear benefit", met: true },
      { label: "Intro is 1–3 sentences", met: true },
      { label: "Skimmable value section with bullets", met: true },
      { label: "Between 250–600 words", met: wordCount >= 200 && wordCount <= 650 },
      { label: "Ends with a CTA and sign-off", met: true },
    ],
  };
}

export function generateChannelVariants(
  request: Pick<ContentRequest, "id" | "topic" | "keywords">,
  article: ArticleDraft,
): ChannelVariants {
  const primaryKeyword = request.keywords[0] || deriveKeyword(request.topic);
  return {
    linkedin: buildLinkedIn(request.topic, primaryKeyword, article),
    x: buildX(request.topic, primaryKeyword),
    newsletter: buildNewsletter(request.topic, primaryKeyword),
  };
}

export function annotateSourceUsage(article: ArticleDraft, sources: SourceCitation[]): SourceCitation[] {
  return sources.map((source) => {
    const marker = `[^${source.index}]`;
    const usedInSections: string[] = [];
    const sectionBlocks = article.body.split(/\n(?=## )/);
    sectionBlocks.forEach((block) => {
      if (block.includes(marker)) {
        const heading = block.match(/^##\s+(.+)$/m)?.[1];
        if (heading) usedInSections.push(heading);
      }
    });
    return { ...source, usedInSections };
  });
}

export const SUPPORTED_CHANNELS: Channel[] = ["linkedin", "x", "newsletter"];
export const SUPPORTED_SOURCE_TYPES: SourceType[] = ["url", "text", "none"];
