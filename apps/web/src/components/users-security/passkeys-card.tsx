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
import { authClient } from "@/lib/auth-client";

export function PasskeysCard() {
  const { data: passkeys, refetch } = authClient.useListPasskeys();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: addError } = await authClient.passkey.addPasskey({ name });
    setLoading(false);
    if (addError) {
      setError(addError.message ?? "Could not add passkey");
      return;
    }
    setName("");
    setOpen(false);
    refetch?.();
  }

  async function onDelete(id: string) {
    await authClient.passkey.deletePasskey({ id });
    refetch?.();
  }

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold">Passkeys</h2>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setError(null);
          }}
        >
          <DialogTrigger render={<Button size="sm" className="h-7 px-3 text-[12px]" />}>
            + Add passkey
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a passkey</DialogTitle>
              <DialogDescription>
                Your browser will prompt you to use a fingerprint, face, security key, or
                password manager.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onAdd} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="passkey-name">Name</Label>
                <Input
                  id="passkey-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. MacBook Touch ID"
                  required
                />
              </div>
              {error && <p className="text-sm text-critical-fg">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? "Adding..." : "Add passkey"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-border">
        {passkeys === undefined && (
          <p className="py-3 text-sm text-muted-foreground">Loading...</p>
        )}
        {passkeys?.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">No passkeys added yet.</p>
        )}
        {passkeys?.map((passkey) => (
          <div key={passkey.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-[13px] font-semibold">{passkey.name ?? "Unnamed passkey"}</p>
              <p className="text-[11px] text-muted-foreground">
                Added {new Date(passkey.createdAt).toLocaleString()}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[12px]"
              onClick={() => onDelete(passkey.id)}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
