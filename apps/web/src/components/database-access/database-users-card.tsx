"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  api,
  type ClusterDto,
  type DatabaseInfoDto,
  type DatabaseUserDto,
  type RoleAssignment,
} from "@/lib/api-client";

const ANY_DB_ROLES = new Set([
  "readAnyDatabase",
  "readWriteAnyDatabase",
  "dbAdminAnyDatabase",
  "userAdminAnyDatabase",
]);

// These roles apply across the whole cluster (always scoped to `admin`),
// so there's no per-database choice to make for them.
const FULL_ACCESS_ROLES = new Set([...ANY_DB_ROLES, "root"]);

const ROLE_OPTIONS = [
  { value: "read", label: "read (single database)" },
  { value: "readWrite", label: "readWrite (single database)" },
  { value: "dbAdmin", label: "dbAdmin (single database)" },
  { value: "dbOwner", label: "dbOwner (single database)" },
  { value: "readAnyDatabase", label: "readAnyDatabase (all databases)" },
  { value: "readWriteAnyDatabase", label: "readWriteAnyDatabase (all databases)" },
  { value: "dbAdminAnyDatabase", label: "dbAdminAnyDatabase (all databases)" },
  { value: "root", label: "root (full cluster admin)" },
];

function emptyRoleRow(): RoleAssignment {
  return { role: "read", db: "" };
}

export function DatabaseUsersCard({ cluster }: { cluster: ClusterDto }) {
  const [users, setUsers] = useState<DatabaseUserDto[] | null>(null);
  const [databases, setDatabases] = useState<DatabaseInfoDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ username: string; password: string } | null>(null);

  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleRows, setRoleRows] = useState<RoleAssignment[]>([emptyRoleRow()]);

  const [resettingUsername, setResettingUsername] = useState<string | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = useCallback(() => {
    api
      .listDatabaseUsers(cluster._id)
      .then((list) => {
        setUsers(list);
        setError(null);
      })
      .catch((err) => {
        setUsers([]);
        setError(err instanceof Error ? err.message : "Could not load database users");
      });
  }, [cluster._id]);

  // The parent remounts this component per cluster (`key={cluster._id}`),
  // so a fresh mount already has clean initial state — this just loads.
  useEffect(() => {
    load();
    api
      .listDatabases(cluster._id)
      .then(setDatabases)
      .catch(() => setDatabases([]));
  }, [load, cluster._id]);

  function updateRoleRow(index: number, patch: Partial<RoleAssignment>) {
    setRoleRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (FULL_ACCESS_ROLES.has(next.role)) next.db = "admin";
        return next;
      }),
    );
  }

  async function onCreate() {
    setError(null);
    setCreating(true);
    try {
      const roles = roleRows.filter((r) => r.role && (r.db || FULL_ACCESS_ROLES.has(r.role)));
      const result = await api.createDatabaseUser(cluster._id, {
        username,
        password: password || undefined,
        roles,
      });
      setRevealed({ username: result.username, password: result.password });
      setUsername("");
      setPassword("");
      setRoleRows([emptyRoleRow()]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create database user");
    } finally {
      setCreating(false);
    }
  }

  function onStartReset(user: DatabaseUserDto) {
    setRevealed(null);
    setResetPasswordInput("");
    setResettingUsername(user.username);
  }

  async function onConfirmReset(username: string) {
    setError(null);
    setResetting(true);
    try {
      const result = await api.resetDatabaseUserPassword(
        cluster._id,
        username,
        resetPasswordInput || undefined,
      );
      setRevealed(result);
      setResettingUsername(null);
      setResetPasswordInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setResetting(false);
    }
  }

  async function onDelete(user: DatabaseUserDto) {
    if (!confirm(`Delete database user "${user.username}"? Anything authenticating with it will lose access immediately.`)) {
      return;
    }
    setError(null);
    try {
      await api.deleteDatabaseUser(cluster._id, user.username);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete database user");
    }
  }

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <h2 className="text-[13.5px] font-bold">Database users — {cluster.name}</h2>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        These are real MongoDB users created directly on this cluster via its stored connection,
        authenticated against the <span className="font-mono">admin</span> database — the same
        model MongoDB Atlas uses for Database Access.
      </p>

      {error && <p className="mt-3 text-sm text-critical-fg">{error}</p>}

      {revealed && (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-warning-fg/30 bg-warning-bg p-3">
          <p className="text-[12.5px] font-semibold text-warning-fg">
            Copy this password now for &quot;{revealed.username}&quot; — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={revealed.password} className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(revealed.password)}
            >
              Copy
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 rounded-md border border-border">
        {users === null && (
          <p className="p-3 text-sm text-muted-foreground">Loading users...</p>
        )}
        {users?.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No database users yet.</p>
        )}
        {users?.map((user) => (
          <div key={user.username} className="border-b border-border p-3 last:border-b-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[13px] font-semibold">{user.username}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {user.roles.map((r, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-neutral-bg px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                    >
                      {r.role}@{r.db}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[12px]"
                  onClick={() => onStartReset(user)}
                >
                  Reset password
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[12px]"
                  onClick={() => onDelete(user)}
                >
                  Delete
                </Button>
              </div>
            </div>

            {resettingUsername === user.username && (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-neutral-bg p-2">
                <Input
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="New password — leave blank to auto-generate"
                  className="h-7 flex-1 text-[12px]"
                />
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-[12px]"
                  disabled={resetting}
                  onClick={() => onConfirmReset(user.username)}
                >
                  {resetting ? "Resetting..." : "Confirm"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[12px]"
                  onClick={() => setResettingUsername(null)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-border p-3">
        <p className="mb-2 text-[12.5px] font-bold">+ New database user</p>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="db-user-username">Username</Label>
              <Input
                id="db-user-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="db-user-password">Password</Label>
              <Input
                id="db-user-password"
                type="text"
                placeholder="Leave blank to auto-generate"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Roles</Label>
            {roleRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={row.role}
                  onChange={(e) => updateRoleRow(i, { role: e.target.value })}
                  className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-[12px]"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {!FULL_ACCESS_ROLES.has(row.role) && (
                  <select
                    value={row.db}
                    onChange={(e) => updateRoleRow(i, { db: e.target.value })}
                    className="h-8 w-40 rounded-md border border-input bg-transparent px-2 text-[12px]"
                  >
                    <option value="">Select a database...</option>
                    {databases?.map((db) => (
                      <option key={db.name} value={db.name}>
                        {db.name}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-[12px]"
                  disabled={roleRows.length === 1}
                  onClick={() => setRoleRows((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-fit px-2.5 text-[12px]"
              onClick={() => setRoleRows((prev) => [...prev, emptyRoleRow()])}
            >
              + Add role
            </Button>
          </div>

          <Button
            onClick={onCreate}
            disabled={creating || !username || roleRows.every((r) => !FULL_ACCESS_ROLES.has(r.role) && !r.db)}
            className="w-fit"
          >
            {creating ? "Creating..." : "Create user"}
          </Button>
        </div>
      </div>
    </div>
  );
}
