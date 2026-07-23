"use client";

import { SidebarNav } from "./sidebar-nav";
import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <aside className="flex w-[236px] shrink-0 flex-col border-r border-border bg-sidebar p-3">
        <div className="mb-4 flex items-center gap-2 px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary text-sm font-bold text-primary-foreground">
            M
          </div>
          <span className="text-sm font-bold">MongoOps Cloud</span>
        </div>

        <div className="mb-4">
          <OrgSwitcher />
        </div>

        <SidebarNav />

        <div className="mt-auto">
          <UserMenu />
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-background px-6">
          <h1 className="text-[15px] font-bold">{title}</h1>
          <div className="flex items-center gap-3">
            {actions}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-7 pb-[60px] pt-6">{children}</main>
      </div>
    </div>
  );
}
