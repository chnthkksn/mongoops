"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { MiniBarChart } from "@/components/mini-bar-chart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, type ClusterDto, type MetricSampleDto } from "@/lib/api-client";

export default function MonitoringPage() {
  const [clusters, setClusters] = useState<ClusterDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [samples, setSamples] = useState<MetricSampleDto[] | null>(null);

  useEffect(() => {
    api.listClusters().then((list) => {
      setClusters(list);
      setSelectedId((current) => current ?? list[0]?._id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;
    const load = () => {
      api
        .getMetrics(selectedId)
        .then((data) => {
          if (!cancelled) setSamples(data);
        })
        .catch(() => {
          if (!cancelled) setSamples([]);
        });
    };

    load();
    const interval = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedId]);

  const selectedCluster = clusters?.find((c) => c._id === selectedId) ?? null;
  const latest = samples?.[samples.length - 1] ?? null;

  return (
    <AppShell title="Monitoring">
      {clusters === null && <p className="text-sm text-muted-foreground">Loading clusters...</p>}
      {clusters?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No clusters connected yet — head to Clusters to connect your first one.
        </p>
      )}

      {clusters && clusters.length > 0 && (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {clusters.map((cluster) => (
              <button
                key={cluster._id}
                onClick={() => {
                  setSelectedId(cluster._id);
                  setSamples(null);
                }}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                  cluster._id === selectedId
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-transparent text-muted-foreground hover:bg-neutral-bg",
                )}
              >
                {cluster.name}
              </button>
            ))}
          </div>

          {samples === null && (
            <p className="text-sm text-muted-foreground">Loading metrics...</p>
          )}

          {samples !== null && samples.length === 0 && (
            <div className="rounded-[10px] border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Collecting metrics — the first sample lands within 30 seconds of connecting a
                cluster. Check back shortly.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-7 px-3 text-[12px]"
                onClick={() =>
                  selectedId &&
                  api
                    .getMetrics(selectedId)
                    .then(setSamples)
                    .catch(() => setSamples([]))
                }
              >
                Refresh now
              </Button>
            </div>
          )}

          {samples !== null && samples.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <MiniBarChart
                title="Connections"
                currentValue={`${latest?.connections.current ?? 0} / ${latest?.connections.available ?? 0}`}
                values={samples.map((s) => s.connections.current)}
              />
              <MiniBarChart
                title="Memory (resident MB)"
                currentValue={`${latest?.memoryMB.resident ?? 0} MB`}
                values={samples.map((s) => s.memoryMB.resident)}
              />
              <MiniBarChart
                title="Query throughput"
                currentValue={`${latest?.throughput?.queriesPerSec ?? 0} ops/s`}
                values={samples.map((s) => s.throughput?.queriesPerSec ?? 0)}
              />
              <MiniBarChart
                title="Write throughput"
                currentValue={`${(latest?.throughput?.insertsPerSec ?? 0) + (latest?.throughput?.updatesPerSec ?? 0) + (latest?.throughput?.deletesPerSec ?? 0)} ops/s`}
                values={samples.map(
                  (s) =>
                    (s.throughput?.insertsPerSec ?? 0) +
                    (s.throughput?.updatesPerSec ?? 0) +
                    (s.throughput?.deletesPerSec ?? 0),
                )}
              />
              {selectedCluster?.topology === "replicaSet" && (
                <MiniBarChart
                  title="Replication lag"
                  currentValue={`${latest?.replicationLagSeconds ?? 0}s`}
                  values={samples.map((s) => s.replicationLagSeconds ?? 0)}
                  tone={
                    (latest?.replicationLagSeconds ?? 0) > 10
                      ? "critical"
                      : (latest?.replicationLagSeconds ?? 0) > 3
                        ? "warning"
                        : "primary"
                  }
                />
              )}
              <MiniBarChart
                title="Long-running operations"
                currentValue={`${latest?.longRunningOps ?? 0}`}
                values={samples.map((s) => s.longRunningOps)}
                tone={(latest?.longRunningOps ?? 0) > 0 ? "warning" : "primary"}
              />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
