import "server-only";
import { Resend } from "resend";
import { escapeHtml, markdownToHtml } from "./email";
import type { ChannelVariants } from "./content-request";

// Resend's free tier (no verified sending domain) can only deliver to the account owner's
// own verified address, so this targets NOTIFICATION_RECIPIENT_EMAIL like every other send
// in this app — swap for a real subscriber list once a domain is verified.
const NEWSLETTER_SENDER = "onboarding@resend.dev";

export type NewsletterContent = NonNullable<ChannelVariants["newsletter"]>;

// Shared by the interactive send-newsletter route and the cron-checked scheduled send —
// throws on failure (missing config or a Resend-reported error) rather than returning a
// result, since the two callers roll back/report differently (a single HTTP error vs. a
// per-row entry in a batch summary) and each already wraps this in its own try/catch.
export async function sendNewsletterEmail(newsletter: NewsletterContent, fallbackTitle: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.NOTIFICATION_RECIPIENT_EMAIL;

  if (!apiKey || !recipient) {
    throw new Error("RESEND_API_KEY or NOTIFICATION_RECIPIENT_EMAIL is not configured on the server.");
  }

  const html = `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
    <h2 style="margin-bottom:8px;">${escapeHtml(newsletter.subject_line || fallbackTitle)}</h2>
    ${
      newsletter.preview_text
        ? `<p style="color:#64748b;font-size:13px;margin-bottom:16px;">${escapeHtml(newsletter.preview_text)}</p>`
        : ""
    }
    ${markdownToHtml(newsletter.body_markdown)}
  </div>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: NEWSLETTER_SENDER,
    to: [recipient],
    subject: newsletter.subject_line || fallbackTitle,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
