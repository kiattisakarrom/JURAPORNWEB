"use client";

import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceNavItem, WorkspaceScreen } from "./shell-types";

export function SidebarNav({
  items,
  activeScreen,
  onSelect,
}: {
  items: WorkspaceNavItem[];
  activeScreen: WorkspaceScreen;
  onSelect: (screen: WorkspaceScreen) => void;
}) {
  return (
    <aside className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-[#22345a] bg-[#0f1f3d] px-2 md:static md:inset-auto md:h-dvh md:w-[76px] md:flex-col md:items-center md:border-r-0 md:border-t-0 md:px-0 md:py-[18px]">
      <div className="mb-[14px] hidden h-[42px] w-[42px] items-center justify-center rounded-xl bg-gradient-to-br from-[#2f6bf3] to-[#1f9be0] text-white shadow-lg shadow-blue-950/30 md:flex">
        <Activity className="h-6 w-6" />
      </div>
      <nav className="grid flex-1 grid-cols-5 gap-1 md:flex md:w-full md:flex-col md:items-center md:gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeScreen === item.id;

          return (
            <button
              aria-label={item.label}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-[5px] rounded-[14px] px-1 py-2 text-[9.5px] font-semibold tracking-[0.02em] text-[#7d92b5] transition hover:bg-[#1d3461] hover:text-white md:h-auto md:w-[60px] md:px-0 md:py-[10px]",
                active && "bg-[#1d3461] text-white shadow-none",
              )}
              key={item.id}
              onClick={() => onSelect(item.id)}
              title={item.label}
              type="button"
            >
              <Icon className={cn("h-[22px] w-[22px] shrink-0", active ? "text-[#5b9bff]" : "text-[#7d92b5]")} />
              <span className="w-full truncate text-center leading-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto hidden h-[38px] w-[38px] items-center justify-center rounded-full bg-[#22345a] text-[13px] font-bold text-[#9fc0ff] md:flex">PJ</div>
    </aside>
  );
}
