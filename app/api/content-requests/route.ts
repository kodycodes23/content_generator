import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const VALID_AUDIENCES = ["executive", "practitioner", "technical"];
const VALID_CHANNELS = ["linkedin", "x", "newsletter"];

const ATTACHMENT_BUCKET = "content-attachments";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(-150) || "upload";
}

async function ensureAttachmentBucket(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.storage.getBucket(ATTACHMENT_BUCKET);
  if (data) return;

  const { error } = await supabase.storage.createBucket(ATTACHMENT_BUCKET, {
    public: true,
    fileSizeLimit: MAX_ATTACHMENT_BYTES,
    allowedMimeTypes: ALLOWED_ATTACHMENT_TYPES,
  });
  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Request body must be multipart/form-data." }, { status: 400 });
  }

  const topic = formData.get("topic");
  const target_audience = formData.get("target_audience");
  const source_url = formData.get("source_url");
  const primaryKeywordsRaw = formData.get("primary_keywords");
  const channelTargetsRaw = formData.get("channel_targets");
  const file = formData.get("file");

  if (typeof topic !== "string" || topic.trim().length < 8) {
    return NextResponse.json({ error: "topic must be at least 8 characters." }, { status: 400 });
  }
  if (typeof target_audience !== "string" || !VALID_AUDIENCES.includes(target_audience)) {
    return NextResponse.json(
      { error: `target_audience must be one of: ${VALID_AUDIENCES.join(", ")}.` },
      { status: 400 },
    );
  }
  if (typeof source_url === "string" && source_url.trim()) {
    try {
      new URL(source_url);
    } catch {
      return NextResponse.json({ error: "source_url must be a valid, absolute URL." }, { status: 400 });
    }
  }

  let primaryKeywords: unknown;
  try {
    primaryKeywords = typeof primaryKeywordsRaw === "string" ? JSON.parse(primaryKeywordsRaw) : [];
  } catch {
    return NextResponse.json({ error: "primary_keywords must be valid JSON." }, { status: 400 });
  }
  if (!Array.isArray(primaryKeywords) || !primaryKeywords.every((k) => typeof k === "string")) {
    return NextResponse.json({ error: "primary_keywords must be a list of strings." }, { status: 400 });
  }

  let channelTargets: unknown;
  try {
    channelTargets = typeof channelTargetsRaw === "string" ? JSON.parse(channelTargetsRaw) : [];
  } catch {
    return NextResponse.json({ error: "channel_targets must be valid JSON." }, { status: 400 });
  }
  if (
    !Array.isArray(channelTargets) ||
    channelTargets.length === 0 ||
    !channelTargets.every((c) => typeof c === "string" && VALID_CHANNELS.includes(c))
  ) {
    return NextResponse.json(
      { error: `channel_targets must include at least one of: ${VALID_CHANNELS.join(", ")}.` },
      { status: 400 },
    );
  }

  let attachmentFile: File | null = null;
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Attachments must be a PNG, JPG, WEBP, or PDF file." }, { status: 400 });
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: "Attachment must be 10MB or smaller." }, { status: 400 });
    }
    attachmentFile = file;
  }

  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nWebhookUrl) {
    return NextResponse.json({ error: "N8N_WEBHOOK_URL is not configured on the server." }, { status: 500 });
  }

  const normalizedSourceUrl = typeof source_url === "string" && source_url.trim() ? source_url.trim() : null;
  const normalizedKeywords = primaryKeywords.map((k) => k.trim()).filter(Boolean);
  const supabaseAdmin = getSupabaseAdmin();

  // Generated up front (rather than left to the DB default) so the uploaded file can be
  // namespaced under the row's own id before the row exists.
  const requestId = crypto.randomUUID();
  let attachmentUrl: string | null = null;
  let attachmentPath: string | null = null;

  if (attachmentFile) {
    try {
      await ensureAttachmentBucket();
      attachmentPath = `${requestId}/${sanitizeFilename(attachmentFile.name)}`;
      const buffer = Buffer.from(await attachmentFile.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).upload(
        attachmentPath,
        buffer,
        { contentType: attachmentFile.type, upsert: false },
      );
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from(ATTACHMENT_BUCKET).getPublicUrl(attachmentPath);
      attachmentUrl = publicUrl;
    } catch (err) {
      // Nothing was inserted yet — fail cleanly rather than create a row with a
      // missing/broken attachment reference.
      return NextResponse.json(
        {
          error: "Could not upload the attachment — the request was not created.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 502 },
      );
    }
  }

  async function cleanupAttachment() {
    if (attachmentPath) {
      await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).remove([attachmentPath]);
    }
  }

  const { data: row, error: insertError } = await supabaseAdmin
    .from("content_requests")
    .insert({
      id: requestId,
      status: "researching",
      topic: topic.trim(),
      target_audience,
      source_url: normalizedSourceUrl,
      attachment_url: attachmentUrl,
      primary_keywords: normalizedKeywords,
      channel_targets: channelTargets,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    await cleanupAttachment();
    return NextResponse.json(
      { error: `Could not create the content request: ${insertError?.message ?? "unknown error"}` },
      { status: 500 },
    );
  }

  try {
    const webhookResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: row.id,
        topic: topic.trim(),
        target_audience,
        source_url: normalizedSourceUrl,
        attachment_url: attachmentUrl,
        primary_keywords: normalizedKeywords,
        channel_targets: channelTargets,
      }),
    });

    if (!webhookResponse.ok) {
      throw new Error(`n8n webhook responded with status ${webhookResponse.status}`);
    }
  } catch (err) {
    // content_requests_status_check has no "failed" state — an unstarted request
    // shouldn't be left sitting in "researching" forever, so remove it (and its
    // attachment, if any) instead.
    await supabaseAdmin.from("content_requests").delete().eq("id", row.id);
    await cleanupAttachment();
    return NextResponse.json(
      {
        error: "Could not start the automation — the request was not saved. Check the n8n webhook and try again.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ id: row.id }, { status: 201 });
}
