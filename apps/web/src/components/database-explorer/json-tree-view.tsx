"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function formatIso(iso: string): string {
  return iso.replace(/Z$/, "+00:00");
}

// MongoDB Extended JSON (relaxed) keeps BSON types that have no native JSON
// equivalent as single-key wrapper objects (e.g. {"$oid": "..."}), even
// though numbers/dates get simplified. Detecting those wrappers lets us
// render them as a single typed value (ObjectId('...'), a plain date
// string, etc.) the way Compass does, instead of expanding them as a
// nested object with one oddly-named child.
function detectExtendedType(value: unknown): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length !== 1) return null;

  const v = value as Record<string, unknown>;
  switch (keys[0]) {
    case "$oid":
      return `ObjectId('${v.$oid}')`;
    case "$date":
      return typeof v.$date === "string" ? formatIso(v.$date) : null;
    case "$numberLong":
      return `Long('${v.$numberLong}')`;
    case "$numberDecimal":
      return `Decimal128('${v.$numberDecimal}')`;
    case "$binary": {
      const bin = v.$binary as { base64?: string; subType?: string } | undefined;
      return `Binary('${bin?.base64 ?? ""}', ${bin?.subType ?? "00"})`;
    }
    case "$regularExpression": {
      const re = v.$regularExpression as { pattern?: string; options?: string } | undefined;
      return `/${re?.pattern ?? ""}/${re?.options ?? ""}`;
    }
    case "$timestamp": {
      const ts = v.$timestamp as { t?: number; i?: number } | undefined;
      return `Timestamp({ t: ${ts?.t ?? 0}, i: ${ts?.i ?? 0} })`;
    }
    case "$minKey":
      return "MinKey()";
    case "$maxKey":
      return "MaxKey()";
    default:
      return null;
  }
}

function ValueLabel({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === "string") return <span className="text-success-fg">&quot;{value}&quot;</span>;
  if (typeof value === "number") return <span className="text-warning-fg">{value}</span>;
  if (typeof value === "boolean") return <span className="text-critical-fg">{String(value)}</span>;
  return null;
}

const INITIAL_ARRAY_ITEMS = 15;
const ARRAY_ITEMS_PER_LOAD = 20;

function TreeNode({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ARRAY_ITEMS);

  const extended = detectExtendedType(value);
  if (extended !== null) {
    return (
      <div
        className="flex items-baseline gap-1.5 py-0.5 font-mono text-[12px]"
        style={{ paddingLeft: depth * 14 }}
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="text-warning-fg">{extended}</span>
      </div>
    );
  }

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
        <span>{label}:</span>
        <span className="text-[11px]">{isArray ? `Array (${entries.length})` : "Object"}</span>
      </button>
      {open && (
        <div>
          {(isArray ? entries.slice(0, visibleCount) : entries).map(([k, v]) => (
            <TreeNode key={k} label={k} value={v} depth={depth + 1} />
          ))}
          {isArray && entries.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((n) => n + ARRAY_ITEMS_PER_LOAD)}
              className="py-0.5 font-mono text-[11px] text-primary hover:underline"
              style={{ paddingLeft: (depth + 1) * 14 }}
            >
              Load {Math.min(ARRAY_ITEMS_PER_LOAD, entries.length - visibleCount)} more (
              {entries.length - visibleCount} remaining)
            </button>
          )}
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
