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
import { ColorSwatchPicker } from "@/components/shell/color-swatch-picker";
import { api } from "@/lib/api-client";

export function AddClusterDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [topology, setTopology] = useState<"standalone" | "replicaSet">("standalone");
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.createCluster({
        name,
        connectionString,
        topology,
        ...(color ? { color } : {}),
      });
      setOpen(false);
      setName("");
      setConnectionString("");
      setTopology("standalone");
      setColor(null);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect cluster");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="h-8 px-3.5 text-[12.5px]" />}>
        + Connect Cluster
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect a MongoDB cluster</DialogTitle>
          <DialogDescription>
            We&apos;ll test the connection and store the credentials encrypted at rest.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cluster-name">Cluster name</Label>
            <Input id="cluster-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="connection-string">Connection string</Label>
            <Input
              id="connection-string"
              placeholder="mongodb://user:pass@host:27017"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              required
              minLength={10}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="topology">Topology</Label>
            <select
              id="topology"
              value={topology}
              onChange={(e) => setTopology(e.target.value as "standalone" | "replicaSet")}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="standalone">Standalone</option>
              <option value="replicaSet">Replica set</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </div>
          {error && <p className="text-sm text-critical-fg">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
