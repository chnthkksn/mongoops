"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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

const TEMPLATE = "{\n  \n}";

export function InsertDocumentDialog({
  clusterId,
  db,
  coll,
  onInserted,
}: {
  clusterId: string;
  db: string;
  coll: string;
  onInserted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(TEMPLATE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onInsert() {
    setError(null);
    setLoading(true);
    try {
      await api.insertDocument(clusterId, db, coll, raw);
      setOpen(false);
      setRaw(TEMPLATE);
      onInserted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not insert document");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setRaw(TEMPLATE);
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" className="h-7 px-2.5 text-[12px]" />}>
        + Insert document
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {db}.{coll}
          </DialogTitle>
          <DialogDescription>Insert a new document (EJSON).</DialogDescription>
        </DialogHeader>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
          className="h-80 w-full resize-none rounded-md border border-input bg-transparent p-3 font-mono text-xs"
        />
        {error && <p className="text-sm text-critical-fg">{error}</p>}
        <DialogFooter>
          <Button onClick={onInsert} disabled={loading}>
            {loading ? "Inserting..." : "Insert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
