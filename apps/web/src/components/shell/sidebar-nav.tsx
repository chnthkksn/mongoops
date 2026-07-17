"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const content = (
          <>
            <span
              className={cn(
                "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-neutral-bg text-neutral-fg",
              )}
            >
              {item.letter}
            </span>
            <span className="truncate">{item.label}</span>
            {!item.enabled && (
              <span className="ml-auto rounded-full bg-neutral-bg px-1.5 py-0.5 text-[10px] font-semibold text-neutral-fg">
                Soon
              </span>
            )}
          </>
        );

        if (!item.enabled) {
          return (
            <div
              key={item.href}
              className="flex cursor-not-allowed items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13.5px] font-medium text-muted-foreground opacity-60"
            >
              {content}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13.5px] font-medium transition-colors hover:bg-neutral-bg",
              active ? "font-bold text-foreground" : "text-foreground",
            )}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
