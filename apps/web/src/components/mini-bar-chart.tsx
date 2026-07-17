import { cn } from "@/lib/utils";

export function MiniBarChart({
  title,
  currentValue,
  values,
  tone = "primary",
  emptyLabel = "No data yet",
}: {
  title: string;
  currentValue: string;
  values: number[];
  tone?: "primary" | "warning" | "critical";
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...values);

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13.5px] font-bold">{title}</h3>
        <span
          className={cn(
            "font-mono text-[13px] font-semibold",
            tone === "warning" && "text-warning-fg",
            tone === "critical" && "text-critical-fg",
            tone === "primary" && "text-success-fg",
          )}
        >
          {currentValue}
        </span>
      </div>
      <div className="mt-3 flex h-16 items-end gap-[3px]">
        {values.length === 0 ? (
          <p className="w-full text-center text-[11px] text-muted-foreground">{emptyLabel}</p>
        ) : (
          values.map((v, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-t-[2px]",
                tone === "warning" && "bg-warning-dot",
                tone === "critical" && "bg-critical-dot",
                tone === "primary" && "bg-success-dot",
              )}
              style={{ height: `${Math.max(4, (v / max) * 100)}%`, opacity: 0.35 + 0.65 * (i / Math.max(1, values.length - 1)) }}
            />
          ))
        )}
      </div>
    </div>
  );
}
