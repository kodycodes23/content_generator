import { NextRequest, NextResponse } from "next/server";
import { getRequest } from "@/lib/store";
import { runRevisionPipeline } from "@/lib/orchestrator";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content/[id]/revise">) {
  const { id } = await ctx.params;
  const current = getRequest(id);
  if (!current) return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  if (current.status !== "pending_review") {
    return NextResponse.json({ error: "Only content pending review can be sent back for revision." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const feedback = typeof (body as { feedback?: unknown })?.feedback === "string" ? (body as { feedback: string }).feedback.trim() : "";
  if (feedback.length < 5) {
    return NextResponse.json({ error: "Feedback must be at least 5 characters." }, { status: 400 });
  }

  runRevisionPipeline(id, feedback).catch((err) => console.error("[koya] revision pipeline error", id, err));

  return NextResponse.json(getRequest(id));
}
