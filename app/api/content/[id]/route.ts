import { NextRequest, NextResponse } from "next/server";
import { getRequest, updateRequest } from "@/lib/store";
import { analyzeText } from "@/lib/readability";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/content/[id]">) {
  const { id } = await ctx.params;
  const record = getRequest(id);
  if (!record) return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/content/[id]">) {
  const { id } = await ctx.params;
  const current = getRequest(id);
  if (!current) return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  if (!current.article) {
    return NextResponse.json({ error: "This request does not have an article draft yet." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { title, content } = (body ?? {}) as { title?: unknown; content?: unknown };
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }

  const { wordCount } = analyzeText(content);
  const updated = updateRequest(id, (curr) => ({
    article: {
      title: typeof title === "string" && title.trim().length > 0 ? title : curr.article!.title,
      body: content,
      wordCount,
    },
  }));

  return NextResponse.json(updated);
}
