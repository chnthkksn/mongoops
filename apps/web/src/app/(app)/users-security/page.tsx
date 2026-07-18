"use client";

import { AppShell } from "@/components/shell/app-shell";
import { TeamMembersCard } from "@/components/users-security/team-members-card";
import { ApiKeysCard } from "@/components/users-security/api-keys-card";
import { AuditLogCard } from "@/components/users-security/audit-log-card";

export default function UsersSecurityPage() {
  return (
    <AppShell title="Users & Security">
      <div className="flex flex-col gap-4">
        <TeamMembersCard />
        <ApiKeysCard />
        <AuditLogCard />
      </div>
    </AppShell>
  );
}
