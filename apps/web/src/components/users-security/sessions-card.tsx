"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient, useSession } from "@/lib/auth-client";

type SessionRow = {
  id: string;
  token: string;
  createdAt: string | Date;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function parseUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";

  let os = "Unknown OS";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/iphone/i.test(ua)) os = "iOS";
  else if (/ipad/i.test(ua)) os = "iPadOS";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua)) browser = "Safari";

  return `${browser} on ${os}`;
}

function formatRelativeExpiry(expiresAt: Date): string {
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return "Expired";

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

export function SessionsCard() {
  const { data: session } = useSession();
  const currentToken = session?.session?.token;

  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    authClient
      .listSessions()
      .then(({ data }) => setSessions((data as SessionRow[] | null) ?? []))
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRevoke(token: string) {
    await authClient.revokeSession({ token });
    load();
  }

  async function onRevokeOthers() {
    setLoading(true);
    await authClient.revokeOtherSessions();
    setLoading(false);
    load();
  }

  const otherSessionsCount = sessions?.filter((s) => s.token !== currentToken).length ?? 0;

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold">Sessions</h2>
        {otherSessionsCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-[12px]"
            onClick={onRevokeOthers}
            disabled={loading}
          >
            {loading ? "Revoking..." : "Revoke other sessions"}
          </Button>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>IP address</TableHead>
              <TableHead>Signed in</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions === null && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {sessions?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No active sessions.
                </TableCell>
              </TableRow>
            )}
            {sessions?.map((s) => {
              const isCurrent = s.token === currentToken;
              const expiresAt = new Date(s.expiresAt);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold">
                    <span className="flex items-center gap-2">
                      {parseUserAgent(s.userAgent)}
                      {isCurrent && (
                        <span className="shrink-0 rounded-full bg-success-bg px-1.5 py-0.5 text-[10px] font-semibold text-success-fg">
                          This device
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.ipAddress ?? "Unknown IP"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {expiresAt.toLocaleString()} ({formatRelativeExpiry(expiresAt)})
                  </TableCell>
                  <TableCell className="text-right">
                    {!isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[12px]"
                        onClick={() => onRevoke(s.token)}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
