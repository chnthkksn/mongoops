"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import {
  api,
  type ClusterDto,
  type StorageProviderDto,
  type BackupScheduleDto,
} from "@/lib/api-client";

export function BackupSchedulesCard() {
  const { data: activeRole } = authClient.useActiveMemberRole();
  const canManage = activeRole?.role === "owner" || activeRole?.role === "admin";

  const [clusters, setClusters] = useState<ClusterDto[] | null>(null);
  const [providers, setProviders] = useState<StorageProviderDto[] | null>(null);
  const [schedules, setSchedules] = useState<BackupScheduleDto[] | null>(null);

  const [open, setOpen] = useState(false);
  const [clusterId, setClusterId] = useState("");
  const [storageProviderId, setStorageProviderId] = useState("");
  const [intervalHours, setIntervalHours] = useState("24");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    api.listBackupSchedules().then(setSchedules).catch(() => setSchedules([]));
  }, []);

  useEffect(() => {
    api.listClusters().then((list) => {
      setClusters(list);
      setClusterId((current) => current || list[0]?._id || "");
    });
    api.listStorageProviders().then((list) => {
      setProviders(list);
      setStorageProviderId((current) => current || list[0]?._id || "");
    });
    load();
  }, [load]);

  function clusterName(id: string) {
    return clusters?.find((c) => c._id === id)?.name ?? id;
  }
  function providerName(id: string) {
    return providers?.find((p) => p._id === id)?.name ?? id;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.createBackupSchedule({
        clusterId,
        storageProviderId,
        intervalHours: Number(intervalHours),
      });
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create schedule");
    } finally {
      setLoading(false);
    }
  }

  async function onToggle(schedule: BackupScheduleDto) {
    await api.updateBackupSchedule(schedule._id, { enabled: !schedule.enabled });
    load();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this backup schedule?")) return;
    await api.deleteBackupSchedule(id);
    load();
  }

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold">Backup Schedules</h2>
        {canManage && (
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setError(null);
            }}
          >
            <DialogTrigger render={<Button size="sm" className="h-7 px-3 text-[12px]" />}>
              + New schedule
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New backup schedule</DialogTitle>
              </DialogHeader>
              <form onSubmit={onCreate} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-[12.5px] font-semibold">Cluster</label>
                  <select
                    value={clusterId}
                    onChange={(e) => setClusterId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-[12.5px]"
                  >
                    {clusters?.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[12.5px] font-semibold">Storage provider</label>
                  <select
                    value={storageProviderId}
                    onChange={(e) => setStorageProviderId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-[12.5px]"
                  >
                    {providers?.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[12.5px] font-semibold">Interval (hours)</label>
                  <input
                    type="number"
                    min={1}
                    value={intervalHours}
                    onChange={(e) => setIntervalHours(e.target.value)}
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-[12.5px]"
                    required
                  />
                </div>
                {error && <p className="text-sm text-critical-fg">{error}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={loading || !clusterId || !storageProviderId}>
                    {loading ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mt-3 flex flex-col divide-y divide-border">
        {schedules === null && <p className="py-3 text-sm text-muted-foreground">Loading...</p>}
        {schedules?.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">No backup schedules yet.</p>
        )}
        {schedules?.map((schedule) => (
          <div key={schedule._id} className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">
                {clusterName(schedule.clusterId)} → {providerName(schedule.storageProviderId)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Every {schedule.intervalHours}h
                {schedule.lastRunAt
                  ? ` · last run ${new Date(schedule.lastRunAt).toLocaleString()}`
                  : " · never run"}
              </p>
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[12px]"
                  onClick={() => onToggle(schedule)}
                >
                  {schedule.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[12px]"
                  onClick={() => onDelete(schedule._id)}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
