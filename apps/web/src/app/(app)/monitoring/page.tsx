"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { TimeSeriesChart, type ChartType } from "@/components/time-series-chart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, type ClusterDto, type MetricSampleDto } from "@/lib/api-client";

const TIME_RANGES = [
  { label: "30m", limit: 60 },
  { label: "1h", limit: 120 },
  { label: "6h", limit: 720 },
  { label: "24h", limit: 2880 },
] as const;

const INTERVALS = [
  { label: "Raw", bucketSize: 1 },
  { label: "1m", bucketSize: 2 },
  { label: "5m", bucketSize: 10 },
  { label: "15m", bucketSize: 30 },
] as const;

function averageBucket(chunk: MetricSampleDto[]): MetricSampleDto {
  const last = chunk[chunk.length - 1];
  const avg = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

  const throughputSamples = chunk
    .map((s) => s.throughput)
    .filter((t): t is NonNullable<MetricSampleDto["throughput"]> => t !== null);
  const lagSamples = chunk
    .map((s) => s.replicationLagSeconds)
    .filter((v): v is number => v !== null);

  return {
    timestamp: last.timestamp,
    connections: {
      current: avg(chunk.map((s) => s.connections.current)),
      available: avg(chunk.map((s) => s.connections.available)),
    },
    memoryMB: {
      resident: avg(chunk.map((s) => s.memoryMB.resident)),
      virtual: avg(chunk.map((s) => s.memoryMB.virtual)),
    },
    replicationLagSeconds: lagSamples.length ? avg(lagSamples) : null,
    longRunningOps: Math.round(avg(chunk.map((s) => s.longRunningOps))),
    throughput: throughputSamples.length
      ? {
          insertsPerSec: avg(throughputSamples.map((t) => t.insertsPerSec)),
          queriesPerSec: avg(throughputSamples.map((t) => t.queriesPerSec)),
          updatesPerSec: avg(throughputSamples.map((t) => t.updatesPerSec)),
          deletesPerSec: avg(throughputSamples.map((t) => t.deletesPerSec)),
        }
      : null,
  };
}

function downsample(samples: MetricSampleDto[], bucketSize: number): MetricSampleDto[] {
  if (bucketSize <= 1) return samples;
  const result: MetricSampleDto[] = [];
  for (let i = 0; i < samples.length; i += bucketSize) {
    result.push(averageBucket(samples.slice(i, i + bucketSize)));
  }
  return result;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-[8px] border border-border p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[6px] px-2.5 py-1 text-[12px] font-semibold transition-colors",
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-neutral-bg",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function MonitoringPage() {
  const [clusters, setClusters] = useState<ClusterDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [samples, setSamples] = useState<MetricSampleDto[] | null>(null);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [rangeLabel, setRangeLabel] = useState<(typeof TIME_RANGES)[number]["label"]>("30m");
  const [intervalLabel, setIntervalLabel] = useState<(typeof INTERVALS)[number]["label"]>("Raw");

  const range = TIME_RANGES.find((r) => r.label === rangeLabel)!;
  const interval = INTERVALS.find((i) => i.label === intervalLabel)!;

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
        .getMetrics(selectedId, range.limit)
        .then((data) => {
          if (!cancelled) setSamples(data);
        })
        .catch(() => {
          if (!cancelled) setSamples([]);
        });
    };

    load();
    const poll = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [selectedId, range.limit]);

  const selectedCluster = clusters?.find((c) => c._id === selectedId) ?? null;
  const latest = samples?.[samples.length - 1] ?? null;
  const chartSamples = samples ? downsample(samples, interval.bucketSize) : [];
  const points = (selector: (s: MetricSampleDto) => number) =>
    chartSamples.map((s) => ({ timestamp: new Date(s.timestamp).getTime(), value: selector(s) }));

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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {clusters.map((cluster) => (
                <button
                  key={cluster._id}
                  onClick={() => {
                    setSelectedId(cluster._id);
                    setSamples(null);
                  }}
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

            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                options={[
                  { label: "Bar", value: "bar" as const },
                  { label: "Line", value: "line" as const },
                ]}
                value={chartType}
                onChange={setChartType}
              />
              <SegmentedControl
                options={TIME_RANGES.map((r) => ({ label: r.label, value: r.label }))}
                value={rangeLabel}
                onChange={setRangeLabel}
              />
              <SegmentedControl
                options={INTERVALS.map((i) => ({ label: i.label, value: i.label }))}
                value={intervalLabel}
                onChange={setIntervalLabel}
              />
            </div>
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
                    .getMetrics(selectedId, range.limit)
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
              <TimeSeriesChart
                title="Connections"
                type={chartType}
                currentValue={`${latest?.connections.current ?? 0} / ${latest?.connections.available ?? 0}`}
                points={points((s) => s.connections.current)}
                valueFormatter={(v) => `${Math.round(v)} connections`}
              />
              <TimeSeriesChart
                title="Memory (resident MB)"
                type={chartType}
                currentValue={`${latest?.memoryMB.resident ?? 0} MB`}
                points={points((s) => s.memoryMB.resident)}
                valueFormatter={(v) => `${Math.round(v)} MB`}
              />
              <TimeSeriesChart
                title="Query throughput"
                type={chartType}
                currentValue={`${latest?.throughput?.queriesPerSec ?? 0} ops/s`}
                points={points((s) => s.throughput?.queriesPerSec ?? 0)}
                valueFormatter={(v) => `${v.toFixed(1)} ops/s`}
              />
              <TimeSeriesChart
                title="Write throughput"
                type={chartType}
                currentValue={`${(latest?.throughput?.insertsPerSec ?? 0) + (latest?.throughput?.updatesPerSec ?? 0) + (latest?.throughput?.deletesPerSec ?? 0)} ops/s`}
                points={points(
                  (s) =>
                    (s.throughput?.insertsPerSec ?? 0) +
                    (s.throughput?.updatesPerSec ?? 0) +
                    (s.throughput?.deletesPerSec ?? 0),
                )}
                valueFormatter={(v) => `${v.toFixed(1)} ops/s`}
              />
              {selectedCluster?.topology === "replicaSet" && (
                <TimeSeriesChart
                  title="Replication lag"
                  type={chartType}
                  currentValue={`${latest?.replicationLagSeconds ?? 0}s`}
                  points={points((s) => s.replicationLagSeconds ?? 0)}
                  valueFormatter={(v) => `${v.toFixed(1)}s`}
                  tone={
                    (latest?.replicationLagSeconds ?? 0) > 10
                      ? "critical"
                      : (latest?.replicationLagSeconds ?? 0) > 3
                        ? "warning"
                        : "primary"
                  }
                />
              )}
              <TimeSeriesChart
                title="Long-running operations"
                type={chartType}
                currentValue={`${latest?.longRunningOps ?? 0}`}
                points={points((s) => s.longRunningOps)}
                valueFormatter={(v) => `${Math.round(v)} ops`}
                tone={(latest?.longRunningOps ?? 0) > 0 ? "warning" : "primary"}
              />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
