import { NextRequest, NextResponse } from "next/server";
import { createRequest, listRequests } from "@/lib/store";
import { runResearchPipeline } from "@/lib/orchestrator";
import type { Audience, Channel, SourceType } from "@/lib/types";

const AUDIENCES: Audience[] = ["executive", "practitioner", "technical"];
const CHANNELS: Channel[] = ["linkedin", "x", "newsletter"];
const SOURCE_TYPES: SourceType[] = ["url", "text", "none"];

export async function GET() {
  return NextResponse.json(listRequests());
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { topic, audience, sourceType, sourceInput, channels, keywords } = body as Record<string, unknown>;

  if (typeof topic !== "string" || topic.trim().length < 8) {
    return NextResponse.json({ error: "Topic or thesis must be at least 8 characters." }, { status: 400 });
  }
  if (typeof audience !== "string" || !AUDIENCES.includes(audience as Audience)) {
    return NextResponse.json({ error: "Select a valid target audience." }, { status: 400 });
  }
  if (typeof sourceType !== "string" || !SOURCE_TYPES.includes(sourceType as SourceType)) {
    return NextResponse.json({ error: "Select a valid source type." }, { status: 400 });
  }
  if (sourceType === "url") {
    try {
      new URL(String(sourceInput));
    } catch {
      return NextResponse.json({ error: "Source URL must be a valid, absolute URL." }, { status: 400 });
    }
  }
  if (sourceType === "text" && (typeof sourceInput !== "string" || sourceInput.trim().length < 20)) {
    return NextResponse.json(
      { error: "Pasted source material should be at least 20 characters." },
      { status: 400 },
    );
  }
  if (!Array.isArray(channels) || channels.length === 0 || !channels.every((c) => CHANNELS.includes(c))) {
    return NextResponse.json({ error: "Select at least one target channel." }, { status: 400 });
  }
  if (!Array.isArray(keywords) || !keywords.every((k) => typeof k === "string")) {
    return NextResponse.json({ error: "Keywords must be a list of strings." }, { status: 400 });
  }

  const created = createRequest({
    topic: topic.trim(),
    audience: audience as Audience,
    sourceType: sourceType as SourceType,
    sourceInput: typeof sourceInput === "string" ? sourceInput.trim() : "",
    channels: channels as Channel[],
    keywords: (keywords as string[]).map((k) => k.trim()).filter(Boolean).slice(0, 8),
    createdBy: "agorua.kody@gmail.com",
  });

  runResearchPipeline(created.id).catch((err) => console.error("[koya] research pipeline error", created.id, err));

  return NextResponse.json(created, { status: 201 });
}
