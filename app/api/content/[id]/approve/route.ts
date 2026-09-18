import { NextResponse } from "next/server";
import { getRequest, updateRequest } from "@/lib/store";
import { runPublishLifecycle } from "@/lib/orchestrator";

export async function POST(_req: Request, ctx: RouteContext<"/api/content/[id]/approve">) {
  const { id } = await ctx.params;
  const current = getRequest(id);
  if (!current) return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  if (current.status !== "pending_review") {
    return NextResponse.json({ error: "Only content pending review can be approved." }, { status: 409 });
  }

  const updated = updateRequest(id, () => ({ status: "approved" }));
  runPublishLifecycle(id, "approved").catch((err) => console.error("[koya] publish pipeline error", id, err));

  return NextResponse.json(updated);
}
