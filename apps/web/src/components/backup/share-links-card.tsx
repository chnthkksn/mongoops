"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { api, type BackupShareLinkDto, type ClusterDto } from "@/lib/api-client";

export function ShareLinksCard() {
  const { data: activeRole } = authClient.useActiveMemberRole();
  const canManage = activeRole?.role === "owner" || activeRole?.role === "admin";
  const confirm = useConfirm();

  const [links, setLinks] = useState<BackupShareLinkDto[] | null>(null);
  const [clusters, setClusters] = useState<ClusterDto[] | null>(null);

  const load = useCallback(() => {
    api.listBackupShareLinks().then(setLinks).catch(() => setLinks([]));
  }, []);

  useEffect(() => {
    api.listClusters().then(setClusters);
    load();
  }, [load]);

  function clusterName(id: string) {
    return clusters?.find((c) => c._id === id)?.name ?? id;
  }

  async function onRevoke(id: string) {
    const ok = await confirm({
      title: "Revoke share link",
      description: "Revoke this share link? It will stop working immediately.",
    });
    if (!ok) return;
    await api.revokeBackupShareLink(id);
    load();
  }

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold">Share Links</h2>
        <button
          type="button"
          onClick={load}
          className="text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cluster</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links === null && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {links?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No share links created yet.
                </TableCell>
              </TableRow>
            )}
            {links?.map((link) => (
              <TableRow key={link._id}>
                <TableCell className="text-xs">{clusterName(link.clusterId)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {new Date(link.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {new Date(link.expiresAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      link.status === "active" && "bg-success-bg text-success-fg",
                      link.status === "expired" && "bg-neutral-bg text-muted-foreground",
                      link.status === "revoked" && "bg-critical-bg text-critical-fg",
                    )}
                  >
                    {link.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {link.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[12px]"
                        onClick={() => navigator.clipboard.writeText(link.url)}
                      >
                        Copy
                      </Button>
                    )}
                    {canManage && link.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[12px]"
                        onClick={() => onRevoke(link._id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
