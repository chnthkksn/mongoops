import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  healthy: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  critical: "bg-critical-bg text-critical-fg",
  unknown: "bg-neutral-bg text-neutral-fg",
};

const LABELS: Record<string, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  unknown: "Unknown",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        STYLES[status] ?? STYLES.unknown,
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
