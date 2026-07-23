"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { DatabaseUsersCard } from "@/components/database-access/database-users-card";
import { cn } from "@/lib/utils";
import { api, type ClusterDto } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export default function DatabaseAccessPage() {
  const { data: activeRole } = authClient.useActiveMemberRole();
  const isOwner = activeRole?.role === "owner";

  const [clusters, setClusters] = useState<ClusterDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api.listClusters().then((list) => {
      setClusters(list);
      setSelectedId((current) => current ?? list[0]?._id ?? null);
    });
  }, []);

  const selectedCluster = clusters?.find((c) => c._id === selectedId) ?? null;

  return (
    <AppShell title="Database Access">
      {!isOwner && (
        <p className="text-sm text-muted-foreground">
          Only organization owners can view and manage database users.
        </p>
      )}

      {isOwner && clusters === null && (
        <p className="text-sm text-muted-foreground">Loading clusters...</p>
      )}
      {isOwner && clusters?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No clusters connected yet — head to Clusters to connect your first one.
        </p>
      )}

      {isOwner && clusters && clusters.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {clusters.map((cluster) => (
              <button
                key={cluster._id}
                onClick={() => setSelectedId(cluster._id)}
                className={cn(
                  "rounded-full border-2 px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                  cluster._id === selectedId
                    ? "border-transparent text-neutral-900"
                    : "border-border bg-transparent text-muted-foreground hover:bg-neutral-bg",
                )}
                style={cluster._id === selectedId ? { backgroundColor: cluster.color } : undefined}
              >
                {cluster.name}
              </button>
            ))}
          </div>

          {selectedCluster && (
            <DatabaseUsersCard cluster={selectedCluster} key={selectedCluster._id} />
          )}
        </>
      )}
    </AppShell>
  );
}
