"use client";

import { useRouter } from "next/navigation";
import { User, Settings, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const { data: session } = useSession();
  const router = useRouter();

  async function onLogout() {
    await signOut();
    router.push("/sign-in");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex w-full items-center gap-2 rounded-[8px] border-t border-border pt-3 text-left hover:bg-neutral-bg" />
        }
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-bg text-xs font-semibold text-neutral-fg">
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" className="h-full w-full object-cover" />
          ) : (
            (session?.user?.name?.[0]?.toUpperCase() ?? "?")
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{session?.user?.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{session?.user?.email}</p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-[204px]">
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <User className="h-3.5 w-3.5" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          <LogOut className="h-3.5 w-3.5" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
