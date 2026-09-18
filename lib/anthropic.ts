import "server-only";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

// Cheap/fast — for simple binary judgments or short extractions, not deep analysis.
export const ANTHROPIC_HAIKU_MODEL = "claude-haiku-4-5-20251001";
// Full-capability — for actually rewriting/patching article content and full rubric
// evaluation, where quality matters more than speed/cost.
export const ANTHROPIC_SONNET_MODEL = "claude-sonnet-5";

// Robust JSON extraction: strips a markdown code fence if present, tries a direct parse,
// and otherwise scans for the first balanced {...} object — tracking string state so
// braces that appear inside quoted strings don't throw off the depth count. Models
// occasionally wrap JSON in prose ("Here's the revised draft:\n\n{...}") despite
// instructions not to; this recovers the object anyway rather than failing outright.
export function extractBalancedJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;

  try {
    return JSON.parse(candidate);
  } catch {
    // fall through to balanced-brace scanning below
  }

  const start = candidate.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in model response.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1));
      }
    }
  }

  throw new Error("Could not find a balanced JSON object in model response.");
}

// Sends a prompt that asks Claude to respond with a single strict-JSON object, and returns
// that parsed object. Throws on any failure (missing key, network error, bad response,
// unparseable JSON) — callers decide how to handle that: surface it as an error, or fail
// open and fall back to a simpler behavior.
export async function callClaudeForJson(
  prompt: string,
  maxTokens: number,
  model: string = ANTHROPIC_HAIKU_MODEL,
): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  // Some models (Sonnet in particular) emit a leading "thinking" content block before the
  // actual "text" block — find the text block by type rather than assuming index 0.
  const content: unknown[] = Array.isArray(data?.content) ? data.content : [];
  const textBlock = content.find(
    (block): block is { type: "text"; text: string } =>
      typeof block === "object" && block !== null && (block as { type?: unknown }).type === "text",
  );
  const text = textBlock?.text;
  if (typeof text !== "string") {
    throw new Error("Anthropic API returned an unexpected response shape.");
  }

  return extractBalancedJson(text);
}
