"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

interface FieldRow {
  field: string;
  direction: 1 | -1;
}

export function IndexWizardDialog({
  clusterId,
  db,
  coll,
  onCreated,
}: {
  clusterId: string;
  db: string;
  coll: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<FieldRow[]>([{ field: "", direction: 1 }]);
  const [unique, setUnique] = useState(false);
  const [sparse, setSparse] = useState(false);
  const [ttl, setTtl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setRows([{ field: "", direction: 1 }]);
    setUnique(false);
    setSparse(false);
    setTtl("");
    setError(null);
  }

  function updateRow(index: number, patch: Partial<FieldRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const keys: Record<string, 1 | -1> = {};
    for (const row of rows) {
      if (row.field.trim()) keys[row.field.trim()] = row.direction;
    }
    if (Object.keys(keys).length === 0) {
      setError("Add at least one field.");
      return;
    }
    setLoading(true);
    try {
      await api.createIndex(clusterId, db, coll, {
        keys,
        unique: unique || undefined,
        sparse: sparse || undefined,
        expireAfterSeconds: rows.length === 1 && ttl ? Number(ttl) : undefined,
      });
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create index");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" className="h-7 px-2.5 text-[12px]" />}>
        + New index
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            New index on {db}.{coll}
          </DialogTitle>
          <DialogDescription>
            TTL is only available for a single-field index (MongoDB&apos;s requirement).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={row.field}
                  onChange={(e) => updateRow(i, { field: e.target.value })}
                  placeholder="field name"
                  className="h-8 flex-1 text-xs"
                />
                <select
                  value={row.direction}
                  onChange={(e) => updateRow(i, { direction: Number(e.target.value) as 1 | -1 })}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  <option value={1}>Asc</option>
                  <option value={-1}>Desc</option>
                </select>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-fit px-2.5 text-[12px]"
              onClick={() => setRows((prev) => [...prev, { field: "", direction: 1 }])}
            >
              + Add field
            </Button>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
              Unique
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sparse} onChange={(e) => setSparse(e.target.checked)} />
              Sparse
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ttl-seconds">TTL seconds (single field only)</Label>
            <Input
              id="ttl-seconds"
              type="number"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              disabled={rows.length !== 1}
              placeholder="e.g. 86400"
            />
          </div>

          {error && <p className="text-sm text-critical-fg">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create index"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
