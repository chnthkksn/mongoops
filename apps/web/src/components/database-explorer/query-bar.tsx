"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface QueryState {
  filter: string;
  sortField: string;
  sortDir: 1 | -1;
  limit: number;
}

export function QueryBar({
  initial,
  onApply,
}: {
  initial: QueryState;
  onApply: (state: QueryState) => void;
}) {
  const [filter, setFilter] = useState(initial.filter);
  const [sortField, setSortField] = useState(initial.sortField);
  const [sortDir, setSortDir] = useState<1 | -1>(initial.sortDir);
  const [limit, setLimit] = useState(initial.limit);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder='{ "field": "value" }'
        className="h-8 max-w-[260px] font-mono text-xs"
      />
      <Input
        value={sortField}
        onChange={(e) => setSortField(e.target.value)}
        placeholder="sort field"
        className="h-8 max-w-[140px] font-mono text-xs"
      />
      <button
        onClick={() => setSortDir((d) => (d === 1 ? -1 : 1))}
        className="flex h-8 items-center rounded-md border border-input px-2 text-xs text-muted-foreground hover:bg-neutral-bg"
        title="Toggle sort direction"
      >
        {sortDir === 1 ? "Asc" : "Desc"}
      </button>
      <select
        value={limit}
        onChange={(e) => setLimit(Number(e.target.value))}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
      >
        {[10, 25, 50, 100].map((n) => (
          <option key={n} value={n}>
            {n} / page
          </option>
        ))}
      </select>
      <Button
        size="sm"
        className="h-8 px-3 text-[12px]"
        onClick={() => onApply({ filter, sortField, sortDir, limit })}
      >
        Apply
      </Button>
    </div>
  );
}
