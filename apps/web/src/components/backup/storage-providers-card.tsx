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
import { api, type StorageProviderDto } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function StorageProvidersCard() {
  const { data: activeRole } = authClient.useActiveMemberRole();
  const isOwner = activeRole?.role === "owner";

  const [providers, setProviders] = useState<StorageProviderDto[] | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [bucket, setBucket] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [forcePathStyle, setForcePathStyle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    api.listStorageProviders().then(setProviders).catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setName("");
    setEndpoint("");
    setRegion("us-east-1");
    setBucket("");
    setAccessKeyId("");
    setSecretAccessKey("");
    setForcePathStyle(false);
    setError(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.createStorageProvider({
        name,
        endpoint,
        region,
        bucket,
        accessKeyId,
        secretAccessKey,
        forcePathStyle,
      });
      setOpen(false);
      reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create storage provider");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this storage provider?")) return;
    await api.deleteStorageProvider(id);
    load();
  }

  async function onTest(id: string) {
    setTestingId(id);
    try {
      await api.testStorageProviderConnection(id);
    } finally {
      setTestingId(null);
      load();
    }
  }

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold">Storage Providers</h2>
        {isOwner && (
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) reset();
            }}
          >
            <DialogTrigger render={<Button size="sm" className="h-7 px-3 text-[12px]" />}>
              + New provider
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New storage provider</DialogTitle>
                <DialogDescription>
                  An S3-compatible bucket to store backups in.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onCreate} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sp-name">Name</Label>
                  <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sp-endpoint">Endpoint</Label>
                  <Input
                    id="sp-endpoint"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="http://localhost:9000"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="sp-region">Region</Label>
                    <Input id="sp-region" value={region} onChange={(e) => setRegion(e.target.value)} required />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor="sp-bucket">Bucket</Label>
                    <Input id="sp-bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} required />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sp-access-key">Access key ID</Label>
                  <Input
                    id="sp-access-key"
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sp-secret">Secret access key</Label>
                  <Input
                    id="sp-secret"
                    type="password"
                    value={secretAccessKey}
                    onChange={(e) => setSecretAccessKey(e.target.value)}
                    required
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={forcePathStyle}
                    onChange={(e) => setForcePathStyle(e.target.checked)}
                  />
                  Path-style addressing (required for MinIO / non-AWS)
                </label>
                {error && <p className="text-sm text-critical-fg">{error}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mt-3 flex flex-col divide-y divide-border">
        {providers === null && <p className="py-3 text-sm text-muted-foreground">Loading...</p>}
        {providers?.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">No storage providers yet.</p>
        )}
        {providers?.map((provider) => (
          <div key={provider._id} className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">{provider.name}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {provider.endpoint} / {provider.bucket}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  provider.status === "healthy" && "bg-success-bg text-success-fg",
                  provider.status === "critical" && "bg-critical-bg text-critical-fg",
                  provider.status === "unknown" && "bg-neutral-bg text-muted-foreground",
                )}
              >
                {provider.status}
              </span>
              {isOwner && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[12px]"
                    disabled={testingId === provider._id}
                    onClick={() => onTest(provider._id)}
                  >
                    {testingId === provider._id ? "Testing..." : "Test"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[12px]"
                    onClick={() => onDelete(provider._id)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
