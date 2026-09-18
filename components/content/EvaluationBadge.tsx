import { scoreTone } from "@/lib/format";

export function EvaluationBadge({
  score,
  size = "md",
  className = "",
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tone = scoreTone(score);
  const sizeClasses =
    size === "lg" ? "px-3 py-1.5 text-base" : size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold tabular-nums ring-1 ring-inset ${tone.text} ${tone.bg} ${tone.ring} ${sizeClasses} ${className}`}
    >
      {score.toFixed(1)}
      <span className="font-normal opacity-60">/10</span>
    </span>
  );
}
