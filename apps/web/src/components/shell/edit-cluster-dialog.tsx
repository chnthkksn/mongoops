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
} from "@/components/ui/dialog";
import { ColorSwatchPicker } from "@/components/shell/color-swatch-picker";
import { pickRandomClusterColor } from "@/lib/cluster-colors";
import { api, type ClusterDto } from "@/lib/api-client";

export function EditClusterDialog({
  cluster,
  open,
  onOpenChange,
  onUpdated,
}: {
  cluster: ClusterDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(cluster.name);
  const [connectionString, setConnectionString] = useState("");
  const [topology, setTopology] = useState<"standalone" | "replicaSet">(cluster.topology);
  const [color, setColor] = useState(cluster.color);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setName(cluster.name);
    setConnectionString("");
    setTopology(cluster.topology);
    setColor(cluster.color);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.updateCluster(cluster._id, {
        name,
        topology,
        color,
        ...(connectionString ? { connectionString } : {}),
      });
      onOpenChange(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update cluster");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit cluster</DialogTitle>
          <DialogDescription>
            Leave the connection string blank to keep the current one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-cluster-name">Cluster name</Label>
            <Input
              id="edit-cluster-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-connection-string">Connection string</Label>
            <Input
              id="edit-connection-string"
              placeholder="Leave blank to keep current connection string"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              minLength={10}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-topology">Topology</Label>
            <select
              id="edit-topology"
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
            <ColorSwatchPicker
              value={color}
              onChange={(next) => setColor(next ?? pickRandomClusterColor())}
            />
          </div>
          {error && <p className="text-sm text-critical-fg">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
