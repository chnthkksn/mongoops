"use client";

import { AppShell } from "@/components/shell/app-shell";
import { BackupRunsCard } from "@/components/backup/backup-runs-card";
import { BackupSchedulesCard } from "@/components/backup/backup-schedules-card";
import { StorageProvidersCard } from "@/components/backup/storage-providers-card";
import { ShareLinksCard } from "@/components/backup/share-links-card";

export default function BackupPage() {
  return (
    <AppShell title="Backup">
      <div className="flex flex-col gap-4">
        <BackupRunsCard />
        <div className="grid grid-cols-2 gap-4">
          <BackupSchedulesCard />
          <StorageProvidersCard />
        </div>
        <ShareLinksCard />
      </div>
    </AppShell>
  );
}
