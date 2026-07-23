"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLUSTER_COLORS } from "@/lib/cluster-colors";

export function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        title="Random"
        onClick={() => onChange(null)}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed text-[9px] font-bold text-muted-foreground",
          value === null ? "border-primary" : "border-border",
        )}
      >
        ?
      </button>
      {CLUSTER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          title={color}
          onClick={() => onChange(color)}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background",
            value === color ? "ring-primary" : "ring-transparent",
          )}
          style={{ backgroundColor: color }}
        >
          {value === color && <Check size={12} className="text-black/60" />}
        </button>
      ))}
    </div>
  );
}
