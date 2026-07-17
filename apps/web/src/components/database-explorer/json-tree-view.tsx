"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function ValueLabel({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === "string") return <span className="text-success-fg">&quot;{value}&quot;</span>;
  if (typeof value === "number") return <span className="text-warning-fg">{value}</span>;
  if (typeof value === "boolean") return <span className="text-critical-fg">{String(value)}</span>;
  return null;
}

function TreeNode({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);

  if (!isObject && !isArray) {
    return (
      <div className="flex items-baseline gap-1.5 py-0.5 font-mono text-[12px]" style={{ paddingLeft: depth * 14 }}>
        <span className="text-muted-foreground">{label}:</span>
        <ValueLabel value={value} />
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 py-0.5 font-mono text-[12px] text-muted-foreground hover:text-foreground"
        style={{ paddingLeft: depth * 14 }}
      >
        <span className={cn("inline-block w-3 text-[10px]", open ? "rotate-90" : "")}>▶</span>
        <span>{label}</span>
        <span className="text-[11px]">
          {isArray ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {open && (
        <div>
          {entries.map(([k, v]) => (
            <TreeNode key={k} label={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function JsonTreeView({ value }: { value: unknown }) {
  if (value === null || typeof value !== "object") {
    return <ValueLabel value={value} />;
  }
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <div>
      {entries.map(([k, v]) => (
        <TreeNode key={k} label={k} value={v} depth={0} />
      ))}
    </div>
  );
}
