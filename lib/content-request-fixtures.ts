import type { ContentRequest } from "./content-request";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

export const FULLY_GENERATED: ContentRequest = {
  id: "demo-full",
  created_at: hoursAgo(5),
  updated_at: hoursAgo(1),
  topic: "Why retainer pricing is quietly becoming the agency growth lever",
  target_audience: "executive",
  channel_targets: ["linkedin", "x", "newsletter"],
  title: "Why Retainer Pricing Is Quietly Becoming the Agency Growth Lever",
  meta_description:
    "Flat-fee retainers are losing ground to value-based pricing. Here's what the data says and how to make the switch without spooking clients.",
  evaluation_score: 9.1,
  status: "pending_human_review",
  evaluation_report: {
    approval_status: "pass",
    overall_score: 9.1,
    grounding_pass: true,
    scores: {
      topic_relevance: 9.4,
      grounding: 9.3,
      factual_consistency: 9.2,
      audience_fit: 9.0,
      tone: 8.9,
      seo_fit: 9.0,
      clarity: 9.1,
      completeness: 8.8,
    },
    critique:
      "Strong, well-grounded draft. Every claim traces back to a cited source and the tone matches the target audience. Minor opportunity to tighten the intro.",
    weak_sections: [],
    recommended_changes: [],
    exit_reason: "passed_evaluation",
    iterations_used: 1,
    channel_fit: {
      linkedin: { passes_checklist: true, violations: [] },
      twitter_thread: { passes_checklist: true, violations: [] },
      newsletter: { passes_checklist: true, violations: [] },
      quote_cards: { passes_checklist: true, violations: [] },
      overall_channel_fit_pass: true,
    },
  },
  featured_image_url: "https://picsum.photos/seed/koya-retainer-pricing/1200/600",
  internal_links: [],
  researched_keywords: {
    short_tail: ["retainer pricing", "agency pricing"],
    long_tail: ["value-based retainer pricing for agencies", "how to switch from hourly to retainer billing"],
  },
  article_draft: `Retainer pricing shapes more of the agency growth conversation than most leadership teams admit. This piece breaks down why it matters, what the research shows, and the specific moves that separate agencies who capture more value from the ones who leave it on the table.

## Why Retainer Pricing Matters Now

Agencies that price purely on hours are structurally capped on margin. The agencies pulling ahead have shifted toward value-based retainers tied to outcomes, not time sheets.

## What the Research Shows

Industry benchmarks show agencies on value-based retainers report 22% higher average account margins than those on hourly billing. That gap has widened over the last two years.

## How to Make the Switch

- Audit your current book of business for candidates with clear, measurable outcomes
- Reframe the pitch around the outcome, not the deliverables list
- Pilot the new structure with one or two trusted accounts first
- Revisit pricing quarterly instead of locking in a year at a time

## Common Mistakes to Avoid

- Switching every client at once instead of piloting first
- Anchoring the new price to the old hourly estimate
- Failing to document the outcome so renewal conversations stay easy

## Key Takeaways

Retainer pricing tied to outcomes is one of the highest-leverage changes an agency can make to its margin structure. Start with your best-fit accounts and expand from there.`,
  sources: [
    {
      fact: "Agencies on value-based retainers report 22% higher average account margins than those on hourly billing.",
      source_url: "https://example-research.io/agency-pricing-benchmark",
      source_title: "2026 Agency Pricing Benchmark Report",
    },
    {
      fact: "68% of agency leaders say pricing conversations are now happening earlier in the sales cycle than two years ago.",
      source_url: "https://example-research.io/agency-sales-trends",
      source_title: "Agency Sales Trends Survey",
    },
    {
      fact: "Clients on outcome-based retainers churn at roughly half the rate of clients on hourly contracts.",
      source_url: "https://example-research.io/client-retention-study",
      source_title: "Client Retention in Professional Services",
    },
  ],
  channel_variants: {
    linkedin: {
      post_text: `Most agencies are leaving money on the table — not because of bad work, but because of how they price it.

Here's the problem: hourly billing puts a hard ceiling on your margin. The better the team gets, the less that efficiency is worth on paper.

Agencies that switched to outcome-based retainers are seeing it directly in their numbers:
→ 22% higher average account margins
→ Roughly half the churn rate
→ Easier renewal conversations, because the value is already documented

The move isn't complicated. Pilot it with your best-fit account first, then expand.

What's stopped your agency from making this switch? Drop it below. 👇`,
    },
    twitter_thread: [
      "Most agencies are pricing themselves out of their own upside. Here's the fix nobody talks about.",
      "Hourly billing caps your margin by design. The better your team gets, the less that efficiency is worth on paper.\n\nOutcome-based retainers flip that.",
      "Agencies that made the switch are seeing 22% higher average account margins — and roughly half the client churn.",
      "The move: pilot with one trusted account, reframe the pitch around the outcome instead of the deliverables list, revisit pricing every quarter instead of locking in a full year at a time, and make sure the outcome is clearly documented well before the renewal conversation ever actually starts.",
      "Do this with your best-fit accounts first. The rest of the book follows once you have proof it works.",
    ],
    newsletter: {
      subject_line: "The pricing shift quietly reshaping agency margins",
      preview_text: "Why value-based retainers are pulling ahead of hourly billing — and how to pilot the switch.",
      body_markdown: `Hey there,

Quick one today: the agencies pulling ahead on margin aren't necessarily doing better work — they're pricing it differently.

**What's changing:**
- Value-based retainers are replacing hourly billing at the top of the market
- Agencies making the switch report 22% higher average account margins
- Client churn on outcome-based contracts runs at roughly half the rate of hourly ones

**One thing to try this week:** pick your best-fit account and pitch the renewal around the outcome instead of the deliverables list. That reframe alone tends to move the number.

If you want the full breakdown — including the mistakes to avoid when you make the switch — the article is linked below.

Talk soon,
The Koya Content Team`,
    },
    quote_cards: [
      "Hourly billing puts a hard ceiling on your margin. The better the team gets, the less that efficiency is worth on paper.",
      "Agencies on value-based retainers report 22% higher average account margins than those on hourly billing.",
      "Clients on outcome-based retainers churn at roughly half the rate of clients on hourly contracts.",
      "Pilot the new structure with one or two trusted accounts before you touch the rest of the book.",
    ],
  },
};

export const PARTIALLY_GENERATED: ContentRequest = {
  ...FULLY_GENERATED,
  id: "demo-partial",
  created_at: hoursAgo(0.3),
  updated_at: hoursAgo(0.1),
  topic: "Why cold outreach response rates are quietly recovering",
  target_audience: "practitioner",
  channel_targets: ["linkedin", "newsletter"],
  title: "Why Cold Outreach Response Rates Are Quietly Recovering",
  evaluation_score: 0,
  status: "researching",
  evaluation_report: null,
  article_draft: "",
  sources: [],
  channel_variants: null,
};

export const NOT_STARTED: ContentRequest = {
  id: "demo-empty",
  created_at: hoursAgo(0.05),
  updated_at: hoursAgo(0.05),
  topic: "How AI search is changing local SEO for service businesses",
  target_audience: "technical",
  channel_targets: ["linkedin", "x"],
  title: "How AI Search Is Changing Local SEO for Service Businesses",
  meta_description: "",
  evaluation_score: 0,
  status: "researching",
  evaluation_report: null,
  article_draft: "",
  sources: [],
  channel_variants: null,
};

export const CAPPED_OUT: ContentRequest = {
  ...FULLY_GENERATED,
  id: "demo-capped",
  created_at: hoursAgo(8),
  updated_at: hoursAgo(2),
  topic: "Why most agency rebrands fail in the first year",
  target_audience: "executive",
  channel_targets: ["linkedin", "newsletter"],
  title: "Why Most Agency Rebrands Fail in the First Year",
  evaluation_score: 7.8,
  status: "pending_human_review",
  evaluation_report: {
    approval_status: "revise",
    overall_score: 7.8,
    grounding_pass: true,
    scores: {
      topic_relevance: 8.5,
      grounding: 8.1,
      factual_consistency: 8.4,
      audience_fit: 7.6,
      tone: 7.2,
      seo_fit: 8.0,
      clarity: 7.9,
      completeness: 7.7,
    },
    critique:
      "Grounding and SEO are solid, but tone drifted more academic than the brand voice across three revision passes. The piece never fully closed the gap on tone within the iteration budget — still readable and factually sound, just worth a human pass on voice before publishing.",
    weak_sections: ["Why Most Rebrands Fail", "Key Takeaways"],
    recommended_changes: [
      "Rewrite the intro in a more conversational voice — it currently reads like an executive summary.",
      "Cut the second paragraph of \"Why Most Rebrands Fail\" by half; it repeats the opening thesis.",
    ],
    exit_reason: "max_iterations_reached",
    iterations_used: 3,
    channel_fit: {
      linkedin: { passes_checklist: true, violations: [] },
      newsletter: { passes_checklist: false, violations: ["Body runs to 720 words, over the 600-word guideline."] },
      overall_channel_fit_pass: false,
    },
  },
  internal_links: [
    { title: "How to Price a Rebrand Engagement", url: "https://koya.example/blog/pricing-a-rebrand" },
    { title: "The Anatomy of a Failed Agency Launch", url: "https://koya.example/blog/failed-agency-launch" },
  ],
  revision_history: [
    {
      revision_number: 1,
      timestamp: hoursAgo(7),
      triggered_by: "content_writer",
      reviewer_notes: "First pass off the research draft — flagging tone as a risk before sending for approval.",
      score_before: null,
      score_after: 6.4,
      approval_status_after: "revise",
    },
    {
      revision_number: 2,
      timestamp: hoursAgo(5),
      triggered_by: "manager",
      reviewer_notes:
        "Rejecting this pass — the intro still reads like an internal memo, not something we'd publish under the brand voice.",
      score_before: 6.4,
      score_after: 6.4,
      approval_status_after: "reject",
    },
    {
      revision_number: 3,
      timestamp: hoursAgo(2),
      triggered_by: "content_writer",
      reviewer_notes: "Rewrote the intro and tightened the rebrand-failure section per feedback.",
      score_before: 6.4,
      score_after: 7.8,
      approval_status_after: "revise",
    },
    {
      revision_number: 4,
      timestamp: hoursAgo(1),
      triggered_by: "manager",
      reviewer_notes: "Change 'fail' to 'stumble' in the title — softer framing for a LinkedIn-heavy distribution.",
      target: "article",
      diff_summary: JSON.stringify([
        { value: "Why Most Agency Rebrands " },
        { value: "Fail", removed: true },
        { value: "Stumble", added: true },
        { value: " in the First Year" },
      ]),
      score_before: null,
      score_after: null,
      approval_status_after: null,
    },
  ],
};

// Exercises every empty/hollow-shape edge case the empty-state audit fixed: a truthy-but-
// empty scores object, a channel_fit with a failing entry that has no violations listed,
// zero sources, zero internal links, zero keywords, and zero channel targets. Nothing here
// should ever render a bare bullet, an empty list, or a stray fragment — every one of these
// should either show a friendly message or hide its section entirely.
export const EMPTY_STATES: ContentRequest = {
  ...FULLY_GENERATED,
  id: "demo-emptystates",
  created_at: hoursAgo(3),
  updated_at: hoursAgo(0.5),
  topic: "Empty-state audit fixture — every hollow shape at once",
  channel_targets: [],
  title: "Empty-State Audit Fixture",
  evaluation_score: 6.0,
  evaluation_report: {
    approval_status: "revise",
    overall_score: 6.0,
    grounding_pass: true,
    scores: {},
    critique: "",
    weak_sections: [],
    recommended_changes: [],
    channel_fit: {
      linkedin: { passes_checklist: false, violations: [] },
      overall_channel_fit_pass: false,
    },
  },
  internal_links: [],
  researched_keywords: { short_tail: [], long_tail: [] },
  sources: [],
};

// A manager's decision queue — status is submitted_for_approval, so this is what exercises
// Manager Preview mode (none of the other fixtures use this status).
export const AWAITING_APPROVAL: ContentRequest = {
  ...FULLY_GENERATED,
  id: "demo-awaiting-approval",
  created_at: hoursAgo(4),
  updated_at: hoursAgo(0.2),
  status: "submitted_for_approval",
};

export const FIXTURES = {
  full: FULLY_GENERATED,
  partial: PARTIALLY_GENERATED,
  empty: NOT_STARTED,
  capped: CAPPED_OUT,
  emptyStates: EMPTY_STATES,
  awaitingApproval: AWAITING_APPROVAL,
} as const;
