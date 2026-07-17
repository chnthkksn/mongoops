"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { api, type ClusterDto } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "warning" | "critical";
}) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-[18px] py-4">
      <p
        className={cn(
          "text-[24px] font-bold",
          tone === "success" && "text-success-fg",
          tone === "warning" && "text-warning-fg",
          tone === "critical" && "text-critical-fg",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[12px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [clusters, setClusters] = useState<ClusterDto[] | null>(null);

  useEffect(() => {
    api.listClusters().then(setClusters).catch(() => setClusters([]));
  }, []);

  const total = clusters?.length ?? 0;
  const healthy = clusters?.filter((c) => c.status === "healthy").length ?? 0;
  const warning = clusters?.filter((c) => c.status === "warning").length ?? 0;
  const critical = clusters?.filter((c) => c.status === "critical").length ?? 0;

  return (
    <AppShell title="Dashboard">
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total Clusters" value={total} tone="default" />
        <StatTile label="Healthy" value={healthy} tone="success" />
        <StatTile label="Needs Attention" value={warning} tone="warning" />
        <StatTile label="Critical" value={critical} tone="critical" />
      </div>

      <div className="mt-6 rounded-[10px] border border-border bg-card p-[18px]">
        <h2 className="text-[13.5px] font-bold">Cluster Overview</h2>
        <div className="mt-3 flex flex-col divide-y divide-border">
          {clusters === null && (
            <p className="py-4 text-sm text-muted-foreground">Loading...</p>
          )}
          {clusters?.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              No clusters connected yet — head to Clusters to connect your first one.
            </p>
          )}
          {clusters?.map((cluster) => (
            <div key={cluster._id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-[13px] font-semibold">{cluster.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {cluster.topology === "standalone" ? "Standalone" : "Replica set"}
                  {cluster.nodeCount ? ` · ${cluster.nodeCount} node(s)` : ""}
                </p>
              </div>
              <StatusBadge status={cluster.status} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
