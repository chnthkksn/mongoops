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

export function CreateCollectionDialog({
  clusterId,
  db,
  onCreated,
}: {
  clusterId: string;
  db: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [capped, setCapped] = useState(false);
  const [size, setSize] = useState("1048576");
  const [max, setMax] = useState("");
  const [validator, setValidator] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setCapped(false);
    setSize("1048576");
    setMax("");
    setValidator("");
    setError(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let parsedValidator: Record<string, unknown> | undefined;
      if (validator.trim()) {
        parsedValidator = JSON.parse(validator) as Record<string, unknown>;
      }
      await api.createCollection(clusterId, db, {
        name,
        capped: capped || undefined,
        size: capped ? Number(size) : undefined,
        max: capped && max ? Number(max) : undefined,
        validator: parsedValidator,
      });
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create collection");
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
        + New collection
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection in {db}</DialogTitle>
          <DialogDescription>Optionally cap its size or add validation rules.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="coll-name">Name</Label>
            <Input id="coll-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={capped} onChange={(e) => setCapped(e.target.checked)} />
            Capped collection
          </label>
          {capped && (
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="coll-size">Size (bytes)</Label>
                <Input
                  id="coll-size"
                  type="number"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="coll-max">Max documents (optional)</Label>
                <Input
                  id="coll-max"
                  type="number"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="coll-validator">Validator (optional JSON)</Label>
            <textarea
              id="coll-validator"
              value={validator}
              onChange={(e) => setValidator(e.target.value)}
              placeholder='{ "$jsonSchema": { ... } }'
              spellCheck={false}
              className="h-24 w-full resize-none rounded-md border border-input bg-transparent p-2 font-mono text-xs"
            />
          </div>
          {error && <p className="text-sm text-critical-fg">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
