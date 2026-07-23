"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  api,
  type ClusterDto,
  type BackupRunDto,
  type StorageProviderDto,
} from "@/lib/api-client";

const SHARE_DURATIONS = [
  { label: "1 hour", seconds: 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "7 days", seconds: 604800 },
];

function formatBytes(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function BackupRunsCard() {
  const { data: activeRole } = authClient.useActiveMemberRole();
  const canManage = activeRole?.role === "owner" || activeRole?.role === "admin";

  const [clusters, setClusters] = useState<ClusterDto[] | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [providers, setProviders] = useState<StorageProviderDto[] | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [runs, setRuns] = useState<BackupRunDto[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shareRun, setShareRun] = useState<BackupRunDto | null>(null);
  const [shareDuration, setShareDuration] = useState(SHARE_DURATIONS[1].seconds);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    api.listClusters().then((list) => {
      setClusters(list);
      setSelectedClusterId((current) => current ?? list[0]?._id ?? null);
    });
    api.listStorageProviders().then((list) => {
      setProviders(list);
      setSelectedProviderId((current) => current || list[0]?._id || "");
    });
  }, []);

  const loadRuns = useCallback(() => {
    if (!selectedClusterId) return;
    api.listBackupRuns(selectedClusterId).then(setRuns);
  }, [selectedClusterId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  async function onRunBackup() {
    if (!selectedClusterId || !selectedProviderId) return;
    setError(null);
    setRunning(true);
    try {
      await api.createBackupRun(selectedClusterId, selectedProviderId);
      loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup run failed");
    } finally {
      setRunning(false);
    }
  }

  async function onRestore(run: BackupRunDto) {
    const collectionCount = run.collections.length;
    const clusterName = clusters?.find((c) => c._id === run.clusterId)?.name ?? "this cluster";
    const confirmed = confirm(
      `This will overwrite ${collectionCount} collection${collectionCount === 1 ? "" : "s"} in ${clusterName}. Anything added to them since this backup was taken will be permanently lost. Continue?`,
    );
    if (!confirmed) return;
    await api.restoreBackupRun(run._id);
    loadRuns();
  }

  async function onDelete(run: BackupRunDto) {
    if (!confirm("Delete this backup run and its stored data?")) return;
    await api.deleteBackupRun(run._id);
    loadRuns();
  }

  async function onDownload(run: BackupRunDto) {
    const { url } = await api.createBackupDownloadUrl(run._id);
    window.open(url, "_blank");
  }

  function openShareDialog(run: BackupRunDto) {
    setShareRun(run);
    setShareUrl(null);
    setShareExpiresAt(null);
    setShareError(null);
    setShareDuration(SHARE_DURATIONS[1].seconds);
  }

  async function onGenerateShareLink() {
    if (!shareRun) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const link = await api.createBackupShareLink(shareRun._id, shareDuration);
      setShareUrl(link.url);
      setShareExpiresAt(link.expiresAt);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Could not generate link");
    } finally {
      setShareLoading(false);
    }
  }

  const selectedCluster = clusters?.find((c) => c._id === selectedClusterId) ?? null;

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold">Backups</h2>
      </div>

      {clusters && clusters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {clusters.map((cluster) => (
            <button
              key={cluster._id}
              onClick={() => setSelectedClusterId(cluster._id)}
              className={cn(
                "rounded-full border-2 px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                cluster._id === selectedClusterId
                  ? "border-transparent text-neutral-900"
                  : "border-border bg-transparent text-muted-foreground hover:bg-neutral-bg",
              )}
              style={cluster._id === selectedClusterId ? { backgroundColor: cluster.color } : undefined}
            >
              {cluster.name}
            </button>
          ))}
        </div>
      )}

      {clusters?.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No clusters connected yet — head to Clusters to connect your first one.
        </p>
      )}

      {canManage && selectedCluster && (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-[12.5px]"
          >
            {providers?.length === 0 && <option value="">No storage providers</option>}
            {providers?.map((provider) => (
              <option key={provider._id} value={provider._id}>
                {provider.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-8 px-3 text-[12.5px]"
            disabled={running || !selectedProviderId}
            onClick={onRunBackup}
          >
            {running ? "Running..." : "Run backup now"}
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-critical-fg">{error}</p>}

      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Collections</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs === null && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {runs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No backups yet for this cluster.
                </TableCell>
              </TableRow>
            )}
            {runs?.map((run) => (
              <TableRow key={run._id}>
                <TableCell className="font-mono text-xs">
                  {new Date(run.startedAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-xs">{run.trigger}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      run.status === "completed" && "bg-success-bg text-success-fg",
                      run.status === "failed" && "bg-critical-bg text-critical-fg",
                      run.status === "running" && "bg-neutral-bg text-muted-foreground",
                    )}
                    title={run.errorMessage ?? undefined}
                  >
                    {run.status}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {formatDuration(run.durationMs)}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {formatBytes(run.totalSizeBytes)}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {run.collections.length}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {run.status === "completed" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-[12px]"
                            onClick={() => onDownload(run)}
                          >
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-[12px]"
                            onClick={() => openShareDialog(run)}
                          >
                            Share link
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-[12px]"
                            onClick={() => onRestore(run)}
                          >
                            Restore
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[12px]"
                        onClick={() => onDelete(run)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={shareRun !== null}
        onOpenChange={(next) => {
          if (!next) setShareRun(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share backup link</DialogTitle>
            <DialogDescription>
              Anyone with this link can download the backup until it expires — no sign-in required.
            </DialogDescription>
          </DialogHeader>
          {shareUrl ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={shareUrl} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                >
                  Copy
                </Button>
              </div>
              {shareExpiresAt && (
                <p className="text-[12px] text-muted-foreground">
                  Expires {new Date(shareExpiresAt).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[12.5px] font-semibold">Link valid for</label>
                <select
                  value={shareDuration}
                  onChange={(e) => setShareDuration(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-[12.5px]"
                >
                  {SHARE_DURATIONS.map((d) => (
                    <option key={d.seconds} value={d.seconds}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              {shareError && <p className="text-sm text-critical-fg">{shareError}</p>}
              <DialogFooter>
                <Button type="button" disabled={shareLoading} onClick={onGenerateShareLink}>
                  {shareLoading ? "Generating..." : "Generate link"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
