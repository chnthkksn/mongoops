"use client";

import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";
import { OrgSwitcher } from "./org-switcher";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const router = useRouter();

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

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-bg text-xs font-semibold text-neutral-fg">
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{session?.user?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{session?.user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={async () => {
              await signOut();
              router.push("/sign-in");
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-background px-6">
          <h1 className="text-[15px] font-bold">{title}</h1>
          {actions}
        </header>
        <main className="flex-1 overflow-y-auto px-7 pb-[60px] pt-6">{children}</main>
      </div>
    </div>
  );
}
