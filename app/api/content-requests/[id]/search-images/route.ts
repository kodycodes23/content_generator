import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeContentRequestRow, type RawContentRequestRow } from "@/lib/content-request";
import { callClaudeForJson } from "@/lib/anthropic";

// Public, unauthenticated search — only the Access Key (as a Client-ID) is needed here.
// UNSPLASH_SECRET_KEY is never used by this feature.
const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";

interface ImageResult {
  id: string;
  url: string;
  thumb_url: string;
  photographer_name: string;
  unsplash_page_url: string;
}

interface UnsplashPhoto {
  id?: string;
  urls?: { regular?: string; thumb?: string };
  user?: { name?: string };
  links?: { html?: string };
}

async function unsplashSearch(query: string, apiKey: string): Promise<ImageResult[]> {
  const searchUrl = new URL(UNSPLASH_SEARCH_URL);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("per_page", "6");
  searchUrl.searchParams.set("orientation", "landscape");

  const response = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Client-ID ${apiKey}` },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unsplash API error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const photos: UnsplashPhoto[] = Array.isArray(data?.results) ? data.results : [];

  return photos
    .filter((photo) => photo.id && photo.urls?.regular && photo.urls?.thumb)
    .map((photo) => ({
      id: photo.id as string,
      url: photo.urls!.regular as string,
      thumb_url: photo.urls!.thumb as string,
      photographer_name: photo.user?.name ?? "Unknown",
      unsplash_page_url: photo.links?.html ?? "",
    }));
}

// Last-resort fallback: ask Claude for a handful of concrete, photographable nouns from the
// draft (or title, if there's no draft yet). A regex/frequency heuristic would be too
// unreliable here — spotting "concrete and visual" needs actual language understanding.
async function extractVisualNouns(sourceText: string): Promise<string[]> {
  const prompt = `Extract 2-4 simple, concrete, visually photographable nouns or short noun phrases from the text below — things a stock photo search would return good results for (e.g. "laptop", "city skyline", "coffee cup", "handshake", "office desk"). Avoid abstract concepts, brand names, jargon, and anything that isn't easily depicted in a photo.

Text:
"""
${sourceText.slice(0, 2000)}
"""

Respond with ONLY strict JSON, no other text, in this exact shape:
{"nouns": string[]}`;

  try {
    const parsed = await callClaudeForJson(prompt, 200);
    const nouns = (parsed as { nouns?: unknown })?.nouns;
    if (!Array.isArray(nouns)) return [];
    return nouns.filter((n): n is string => typeof n === "string" && n.trim().length > 0).slice(0, 4);
  } catch (err) {
    console.log("[search-images] visual-noun extraction failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/content-requests/[id]/search-images">) {
  const { id } = await ctx.params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // No body is fine — falls into the auto/default path below.
  }

  const bodyQuery = typeof (body as { query?: unknown })?.query === "string" ? (body as { query: string }).query.trim() : "";
  const paramQuery = req.nextUrl.searchParams.get("query")?.trim() ?? "";
  const explicitQuery = bodyQuery || paramQuery;

  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "UNSPLASH_ACCESS_KEY is not configured on the server." }, { status: 500 });
  }

  // An explicit, user-typed query is an intentional search — search exactly that term,
  // with no fallback chain applied.
  if (explicitQuery) {
    let results: ImageResult[];
    try {
      results = await unsplashSearch(explicitQuery, apiKey);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not reach Unsplash." },
        { status: 502 },
      );
    }
    console.log(`[search-images] explicit query "${explicitQuery}" -> ${results.length} result(s)`);
    return NextResponse.json({ query: explicitQuery, results });
  }

  // Auto/default path: topic -> title -> primary_keywords -> extracted visual nouns.
  const { data, error: fetchError } = await getSupabaseAdmin().from("content_requests").select("*").eq("id", id).single();
  if (fetchError || !data) {
    return NextResponse.json({ error: "Content request not found." }, { status: 404 });
  }
  const request = normalizeContentRequestRow(data as RawContentRequestRow);

  const defaultQuery = request.topic?.trim() || request.title?.trim() || "";
  if (!defaultQuery) {
    return NextResponse.json(
      { error: "No search query available — provide one, or set a title/topic on this request first." },
      { status: 400 },
    );
  }

  let results: ImageResult[];
  try {
    results = await unsplashSearch(defaultQuery, apiKey);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not reach Unsplash." },
      { status: 502 },
    );
  }
  let usedQuery = defaultQuery;
  let strategy = "topic/title";

  if (results.length === 0 && request.primary_keywords && request.primary_keywords.length > 0) {
    const keywordQuery = request.primary_keywords.slice(0, 3).join(" ");
    try {
      const keywordResults = await unsplashSearch(keywordQuery, apiKey);
      if (keywordResults.length > 0) {
        results = keywordResults;
        usedQuery = keywordQuery;
        strategy = "primary_keywords";
      }
    } catch (err) {
      console.log("[search-images] primary_keywords fallback search failed:", err instanceof Error ? err.message : err);
    }
  }

  if (results.length === 0) {
    const sourceText = request.article_draft?.trim() || request.title?.trim() || defaultQuery;
    const nouns = await extractVisualNouns(sourceText);
    if (nouns.length > 0) {
      const nounQuery = nouns.join(" ");
      try {
        const nounResults = await unsplashSearch(nounQuery, apiKey);
        if (nounResults.length > 0) {
          results = nounResults;
          usedQuery = nounQuery;
          strategy = "extracted visual nouns";
        }
      } catch (err) {
        console.log("[search-images] visual-noun fallback search failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  if (results.length === 0) {
    strategy = "none — all fallbacks exhausted";
  }

  console.log(
    `[search-images] auto search for request ${id}: strategy="${strategy}", query="${usedQuery}", results=${results.length}`,
  );

  return NextResponse.json({ query: usedQuery, results });
}
