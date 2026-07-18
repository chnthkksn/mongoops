"use client";

import { AppShell } from "@/components/shell/app-shell";
import { SecurityCard } from "@/components/users-security/security-card";
import { SessionsCard } from "@/components/users-security/sessions-card";
import { PasskeysCard } from "@/components/users-security/passkeys-card";

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <div className="flex flex-col gap-4">
        <SecurityCard />
        <PasskeysCard />
        <SessionsCard />
      </div>
    </AppShell>
  );
}
