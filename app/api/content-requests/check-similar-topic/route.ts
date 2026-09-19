import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { callClaudeForJson } from "@/lib/anthropic";
import type { ContentRequestStatus } from "@/lib/content-request";

// Advisory, pre-submission check — never blocks the actual create (app/api/content-requests
// route is unchanged). Called by RequestForm before it submits, so a writer can catch
// "this is basically the same story again" before spending a full pipeline run on it.
interface ExistingRow {
  id: string;
  topic: string;
  title: string | null;
  status: ContentRequestStatus;
  created_at: string;
}

interface SimilarMatch {
  id: string;
  topic: string;
  title: string | null;
  status: ContentRequestStatus;
  reason: string;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const topic = typeof (body as { topic?: unknown })?.topic === "string" ? (body as { topic: string }).topic.trim() : "";
  if (!topic) {
    return NextResponse.json({ error: "topic is required." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("content_requests")
    .select("id, topic, title, status, created_at")
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Could not load existing requests to compare against." }, { status: 502 });
  }

  const existingRows = (data ?? []) as ExistingRow[];
  if (existingRows.length === 0) {
    return NextResponse.json({ similar: [] });
  }

  const prompt = `You are checking whether a new content topic significantly overlaps with topics already in a content pipeline.

New topic:
"""
${topic}
"""

Existing topics, each with an id:
${existingRows.map((r) => `- id: ${r.id} | topic: ${r.topic}`).join("\n")}

Identify which existing topics, if any, cover substantially the same subject as the new one — genuine topical overlap someone would consider "the same story again," not just shared keywords. This includes cases where the new topic is paraphrased or worded very differently but means essentially the same thing. Do NOT flag topics that are merely related or adjacent — only genuine near-duplicates.

Respond with ONLY strict JSON, no markdown fences, in this exact shape:
{"similar": [{"id": "the existing topic's id", "reason": "one short sentence explaining the overlap"}]}

Return {"similar": []} if nothing is meaningfully similar.`;

  let parsed: unknown;
  try {
    parsed = await callClaudeForJson(prompt, 1024);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not check for similar topics with the Anthropic API." },
      { status: 502 },
    );
  }

  const rawSimilar = (parsed as { similar?: unknown })?.similar;
  if (!Array.isArray(rawSimilar)) {
    return NextResponse.json({ error: "Model response was missing the expected 'similar' array." }, { status: 502 });
  }

  // Never trust the model to echo back topic/title/status accurately — look each match up
  // by id against what was actually fetched, and silently drop anything it hallucinated.
  const byId = new Map(existingRows.map((r) => [r.id, r]));
  const similar: SimilarMatch[] = [];
  for (const entry of rawSimilar) {
    const id = typeof (entry as { id?: unknown })?.id === "string" ? (entry as { id: string }).id : null;
    const reason = typeof (entry as { reason?: unknown })?.reason === "string" ? (entry as { reason: string }).reason : null;
    const row = id ? byId.get(id) : undefined;
    if (!row || !reason) continue;
    similar.push({ id: row.id, topic: row.topic, title: row.title, status: row.status, reason });
  }

  return NextResponse.json({ similar });
}
