"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { AddClusterDialog } from "@/components/shell/add-cluster-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type ClusterDto } from "@/lib/api-client";

export default function ClustersPage() {
  const [clusters, setClusters] = useState<ClusterDto[] | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.listClusters().then(setClusters).catch(() => setClusters([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTestConnection(id: string) {
    setTestingId(id);
    try {
      await api.testConnection(id);
    } finally {
      setTestingId(null);
      load();
    }
  }

  return (
    <AppShell
      title="Clusters"
      actions={
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground">
            {clusters?.length ?? 0} clusters connected
          </span>
          <AddClusterDialog onCreated={load} />
        </div>
      }
    >
      <div className="overflow-hidden rounded-[10px] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Topology</TableHead>
              <TableHead>Nodes</TableHead>
              <TableHead>Last checked</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clusters === null && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading clusters...
                </TableCell>
              </TableRow>
            )}
            {clusters?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No clusters connected yet. Click &quot;Connect Cluster&quot; to add one.
                </TableCell>
              </TableRow>
            )}
            {clusters?.map((cluster) => (
              <TableRow key={cluster._id}>
                <TableCell className="font-semibold">{cluster.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {cluster.topology === "standalone" ? "Standalone" : "Replica set"}
                </TableCell>
                <TableCell className="font-mono text-xs">{cluster.nodeCount ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {cluster.lastCheckedAt ? new Date(cluster.lastCheckedAt).toLocaleString() : "Never"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={cluster.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[12px]"
                    disabled={testingId === cluster._id}
                    onClick={() => handleTestConnection(cluster._id)}
                  >
                    {testingId === cluster._id ? "Testing..." : "Test connection"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
