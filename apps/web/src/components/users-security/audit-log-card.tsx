"use client";

import { useEffect, useState } from "react";
import { api, type AuditLogDto } from "@/lib/api-client";

// member.added/removed/role_updated are subject-based ("X joined as...")
// rather than actor-based, because better-auth doesn't pass the acting
// admin through to those hooks — see the note in auth.instance.ts.
const ACTION_LABELS: Record<string, string> = {
  "member.added": "joined as",
  "member.removed": "was removed from the organization",
  "member.role_updated": "role changed to",
  "invitation.created": "invited",
  "invitation.accepted": "invitation accepted by",
  "invitation.canceled": "canceled invitation for",
  "apikey.created": "created API key",
  "apikey.revoked": "revoked API key",
  "cluster.connected": "connected cluster",
};

const NO_TARGET_ACTIONS = new Set(["member.removed"]);

export function AuditLogCard() {
  const [logs, setLogs] = useState<AuditLogDto[] | null>(null);

  useEffect(() => {
    api.listAuditLogs().then(setLogs).catch(() => setLogs([]));
  }, []);

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <h2 className="text-[13.5px] font-bold">Audit Log</h2>
      <div className="mt-3 flex flex-col divide-y divide-border">
        {logs === null && <p className="py-3 text-sm text-muted-foreground">Loading...</p>}
        {logs?.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">No activity recorded yet.</p>
        )}
        {logs?.map((log) => (
          <div key={log._id} className="flex items-center gap-3 py-2.5">
            <span className="font-mono text-[11px] text-muted-foreground">
              {new Date(log.createdAt).toLocaleString()}
            </span>
            <span className="text-[12.5px]">
              <span className="font-semibold">{log.actorName}</span>{" "}
              {ACTION_LABELS[log.action] ?? log.action}
              {!NO_TARGET_ACTIONS.has(log.action) && (
                <>
                  {" "}
                  <span className="font-medium">{log.targetLabel}</span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
