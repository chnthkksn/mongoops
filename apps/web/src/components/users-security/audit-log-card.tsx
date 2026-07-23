"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
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
const PAGE_SIZE = 30;

export function AuditLogCard() {
  const [logs, setLogs] = useState<AuditLogDto[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(
    (skip: number, replace: boolean) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      api
        .listAuditLogs({
          limit: PAGE_SIZE,
          skip,
          from: range?.from ? startOfDay(range.from).toISOString() : undefined,
          to: range?.to ? endOfDay(range.to).toISOString() : undefined,
        })
        .then((result) => {
          setLogs((prev) => (replace || !prev ? result.logs : [...prev, ...result.logs]));
          setTotal(result.total);
        })
        .catch(() => {
          if (replace) setLogs([]);
        })
        .finally(() => {
          fetchingRef.current = false;
        });
    },
    [range],
  );

  // Date range changed (or first mount) — reload from the top.
  useEffect(() => {
    fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const hasMore = logs !== null && total !== null && logs.length < total;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchPage(logs!.length, false);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, logs]);

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13.5px] font-bold">Audit Log</h2>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="mt-3 flex max-h-[480px] flex-col divide-y divide-border overflow-y-auto">
        {logs === null && <p className="py-3 text-sm text-muted-foreground">Loading...</p>}
        {logs?.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">
            No activity recorded{range?.from ? " in this range" : " yet"}.
          </p>
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
        {hasMore && (
          <div ref={sentinelRef} className="py-3 text-center text-[11px] text-muted-foreground">
            Loading more...
          </div>
        )}
      </div>
    </div>
  );
}
