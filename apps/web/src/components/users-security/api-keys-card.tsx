"use client";

import { useCallback, useEffect, useState } from "react";
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
import { api, type ApiKeyDto } from "@/lib/api-client";

export function ApiKeysCard() {
  const { data: activeRole } = authClient.useActiveMemberRole();
  const isOwner = activeRole?.role === "owner";

  const [keys, setKeys] = useState<ApiKeyDto[] | null>(null);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    if (!isOwner) return;
    api.listApiKeys().then(setKeys).catch(() => setKeys([]));
  }, [isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isOwner) {
    return null;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.createApiKey(name);
      setCreatedKey(result.key);
      setName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create key");
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(id: string) {
    await api.revokeApiKey(id);
    load();
  }

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold">API Keys</h2>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setCreatedKey(null);
              setError(null);
            }
          }}
        >
          <DialogTrigger render={<Button size="sm" className="h-7 px-3 text-[12px]" />}>
            + New key
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create an API key</DialogTitle>
              <DialogDescription>
                {createdKey
                  ? "Copy this key now — you won't be able to see it again."
                  : "Give the key a name so you can recognize it later."}
              </DialogDescription>
            </DialogHeader>
            {createdKey ? (
              <div className="flex items-center gap-2">
                <Input readOnly value={createdKey} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(createdKey)}
                >
                  Copy
                </Button>
              </div>
            ) : (
              <form onSubmit={onCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="key-name">Name</Label>
                  <Input
                    id="key-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
                {error && <p className="text-sm text-critical-fg">{error}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create key"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-border">
        {keys === null && <p className="py-3 text-sm text-muted-foreground">Loading...</p>}
        {keys?.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">No API keys yet.</p>
        )}
        {keys?.map((key) => (
          <div key={key.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-[13px] font-semibold">{key.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{key.start}...</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[12px]"
              onClick={() => onRevoke(key.id)}
            >
              Revoke
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
