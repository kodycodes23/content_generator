import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";

function baseUrl(): string {
  const raw = process.env.CONTENT_BASE_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

function reviewUrl(id: string): string {
  return `${baseUrl()}/dashboard/${id}/review`;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(heading: string, bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
    <h2 style="margin-bottom:16px;">${escapeHtml(heading)}</h2>
    ${bodyHtml}
  </div>`;
}

function noteBlock(notes: string): string {
  return `<blockquote style="margin:12px 0;padding-left:12px;border-left:3px solid #e2e8f0;color:#475569;">${escapeHtml(notes)}</blockquote>`;
}

function actionButton(url: string, label: string): string {
  return `<p style="margin-top:20px;"><a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">${escapeHtml(label)}</a></p>`;
}

// Mirrors components/content/SimpleMarkdown.tsx's block/inline parsing, but emits an HTML
// string directly — that component can't be reused here since Next.js's App Router route
// handlers aren't allowed to import react-dom/server to statically render it.
function renderInlineHtml(text: string): string {
  const inlineRegex = /\*\*([^*]+)\*\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\)/g;
  let html = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text))) {
    if (match.index > lastIndex) html += escapeHtml(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      html += `<strong>${escapeHtml(match[1])}</strong>`;
    } else if (match[2] !== undefined) {
      html += `<em>${escapeHtml(match[2])}</em>`;
    } else if (match[3] !== undefined) {
      html += `<a href="${escapeHtml(match[4])}" style="color:#4f46e5;">${escapeHtml(match[3])}</a>`;
    }
    lastIndex = inlineRegex.lastIndex;
  }
  if (lastIndex < text.length) html += escapeHtml(text.slice(lastIndex));
  return html;
}

// Also reused directly by the send-newsletter route (which uses the Resend SDK rather
// than the raw-fetch sendEmail below, per that route's own requirements) so the two
// newsletter-rendering paths never drift apart.
export function markdownToHtml(source: string): string {
  const lines = source.split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const size = level === 1 ? "20px" : level === 2 ? "17px" : "15px";
      blocks.push(`<p style="font-weight:600;font-size:${size};margin:20px 0 8px;">${renderInlineHtml(heading[2])}</p>`);
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${renderInlineHtml(lines[i].replace(/^[-*]\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ul style="margin:8px 0;padding-left:20px;">${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInlineHtml(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ol style="margin:8px 0;padding-left:20px;">${items.join("")}</ol>`);
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
    blocks.push(`<p style="margin:8px 0;line-height:1.6;">${renderInlineHtml(paraLines.join(" "))}</p>`);
  }

  return blocks.join("\n");
}

// Every failure here is swallowed (logged, not thrown) — a notification email failing to
// send shouldn't roll back a status change that already succeeded, unlike the storage/webhook
// steps elsewhere in this app that a request's own correctness depends on.
async function sendEmail({ subject, html }: { subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.NOTIFICATION_RECIPIENT_EMAIL;

  if (!apiKey || !from || !to) {
    console.error("Email not sent — RESEND_API_KEY, EMAIL_FROM, or NOTIFICATION_RECIPIENT_EMAIL is not configured.");
    return;
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], reply_to: to, subject, html }),
    });
    if (!res.ok) {
      console.error(`Resend send failed (${res.status}): ${await res.text()}`);
    }
  } catch (err) {
    console.error("Resend send threw:", err);
  }
}

export async function sendSubmittedForApprovalEmail({ id, title }: { id: string; title: string }): Promise<void> {
  await sendEmail({
    subject: `Ready for your approval: ${title}`,
    html: layout(
      "New content ready for approval",
      `<p><strong>${escapeHtml(title)}</strong> has been sent for your review.</p>${actionButton(reviewUrl(id), "Review & decide")}`,
    ),
  });
}

export async function sendRevisionRequestedEmail({
  id,
  title,
  reviewerNotes,
}: {
  id: string;
  title: string;
  reviewerNotes: string;
}): Promise<void> {
  await sendEmail({
    subject: `Revision requested: ${title}`,
    html: layout(
      "Sent back for revision",
      `<p><strong>${escapeHtml(title)}</strong> needs changes before it can be approved.</p>${noteBlock(reviewerNotes)}${actionButton(reviewUrl(id), "Open in editor")}`,
    ),
  });
}

export async function sendDecisionEmail({
  id,
  title,
  decision,
  reviewerNotes,
}: {
  id: string;
  title: string;
  decision: "approved" | "rejected";
  reviewerNotes?: string | null;
}): Promise<void> {
  await sendEmail({
    subject: `${decision === "approved" ? "Approved" : "Rejected"}: ${title}`,
    html: layout(
      `Your content was ${decision}`,
      `<p><strong>${escapeHtml(title)}</strong> was ${decision} by the manager.</p>${
        reviewerNotes ? noteBlock(reviewerNotes) : ""
      }${actionButton(reviewUrl(id), "View the page")}`,
    ),
  });
}

export async function sendPublishedEmail({ id, title }: { id: string; title: string }): Promise<void> {
  await sendEmail({
    subject: `Published: ${title}`,
    html: layout(
      "Content published",
      `<p><strong>${escapeHtml(title)}</strong> has been published.</p>${actionButton(reviewUrl(id), "View the page")}`,
    ),
  });
}
