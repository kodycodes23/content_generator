import { NextRequest, NextResponse } from "next/server";
import { getRequest, updateRequest } from "@/lib/store";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content/[id]/reject">) {
  const { id } = await ctx.params;
  const current = getRequest(id);
  if (!current) return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  if (current.status !== "pending_review") {
    return NextResponse.json({ error: "Only content pending review can be rejected." }, { status: 409 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // reason is optional
  }

  const reason = typeof (body as { reason?: unknown })?.reason === "string" ? (body as { reason: string }).reason.trim() : "";

  const updated = updateRequest(id, () => ({
    status: "rejected",
    rejectionReason: reason || "Rejected by reviewer without a stated reason.",
  }));

  return NextResponse.json(updated);
}
