"use client";

import { useState } from "react";
import { Pencil, Eye } from "lucide-react";
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
import { authClient } from "@/lib/auth-client";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api, type DocumentDto } from "@/lib/api-client";

export function DocumentEditDialog({
  clusterId,
  db,
  coll,
  document,
  onSaved,
  onDeleted,
}: {
  clusterId: string;
  db: string;
  coll: string;
  document: DocumentDto;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { data: activeRole } = authClient.useActiveMemberRole();
  const canEdit = activeRole?.role === "owner" || activeRole?.role === "admin";
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(document.raw);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onSave() {
    setError(null);
    setLoading(true);
    try {
      await api.updateDocument(clusterId, db, coll, raw);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save document");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Delete document",
      description: `Delete document ${document.id}? This cannot be undone.`,
    });
    if (!ok) return;
    setError(null);
    setDeleting(true);
    try {
      await api.deleteDocument(clusterId, db, coll, document.id);
      setOpen(false);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete document");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setRaw(document.raw);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <button
            title={canEdit ? "Edit document" : "View document"}
            className="rounded-[4px] p-1.5 text-muted-foreground hover:bg-neutral-bg hover:text-foreground"
          />
        }
      >
        {canEdit ? <Pencil size={14} /> : <Eye size={14} />}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {db}.{coll}
          </DialogTitle>
          <DialogDescription>
            {canEdit
              ? "Editing replaces the entire document. Fields not present here will be removed."
              : "Read-only — only owners and admins can edit documents."}
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          readOnly={!canEdit}
          spellCheck={false}
          className="h-80 w-full resize-none rounded-md border border-input bg-transparent p-3 font-mono text-xs"
        />
        {error && <p className="text-sm text-critical-fg">{error}</p>}
        {canEdit && (
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={deleting || loading}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
            <Button onClick={onSave} disabled={loading || deleting}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
