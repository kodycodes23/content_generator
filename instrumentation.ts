export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { resumeInFlightPipelines } = await import("./lib/orchestrator");
    resumeInFlightPipelines();
  }
}
