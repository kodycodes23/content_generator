export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // resumeInFlightPipelines is part of the legacy in-memory/file-backed pipeline (lib/store.ts),
    // which writes to a local .data/ directory — not available on Vercel's read-only filesystem.
    // A failure here must not take down the whole app; the live Supabase-backed flow doesn't
    // depend on this at all.
    try {
      const { resumeInFlightPipelines } = await import("./lib/orchestrator");
      resumeInFlightPipelines();
    } catch (err) {
      console.error("instrumentation: resumeInFlightPipelines failed, continuing without it", err);
    }
  }
}
