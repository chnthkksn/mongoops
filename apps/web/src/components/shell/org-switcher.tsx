"use client";

import { ChevronsUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function OrgSwitcher() {
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();

  async function switchTo(organizationId: string) {
    if (organizationId === activeOrganization?.id) return;
    await authClient.organization.setActive({ organizationId });
    window.location.reload();
  }

  if (!organizations || organizations.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex w-full items-center gap-2 rounded-[8px] px-1 py-1.5 text-left hover:bg-neutral-bg" />
        }
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-primary text-[11px] font-bold text-primary-foreground">
          {activeOrganization?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
          {activeOrganization?.name ?? "Select organization"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[204px]">
        {organizations.map((org) => (
          <DropdownMenuItem key={org.id} onClick={() => switchTo(org.id)}>
            <span className="min-w-0 flex-1 truncate">{org.name}</span>
            {org.id === activeOrganization?.id && (
              <Check className={cn("h-3.5 w-3.5 text-primary")} />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
