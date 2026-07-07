"use client";

import { Activity, Clock3, LogOut, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QueueSummary } from "@/types/pharmacy";
import type { WorkspaceNavItem } from "./shell-types";

export function WorkspaceHeader({
  activeItem,
  liveTime,
  search,
  summary,
  onLogout,
  onSearch,
}: {
  activeItem: WorkspaceNavItem;
  liveTime: string;
  search: string;
  summary?: QueueSummary;
  onLogout: () => void;
  onSearch: (value: string) => void;
}) {
  return (
    <header className="relative z-30 shrink-0 border-b border-[#e6eaf0] bg-white">
      <div className="flex min-h-[78px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:gap-[22px] lg:px-[26px]">
        <div className="flex min-w-0 items-center justify-between gap-4 lg:min-w-[248px]">
          <div className="flex min-w-0 items-center gap-[13px]">
            <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#2f6bf3] to-[#1f9be0] text-white shadow-lg shadow-blue-200">
              <Activity className="h-[26px] w-[26px]" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[20px] font-bold leading-none tracking-[-0.01em] text-[#15233b]">PharmAuto OPD</div>
              <div className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a97a8]">{activeItem.subtitle}</div>
            </div>
          </div>
          <Button className="lg:hidden" onClick={onLogout} size="icon" variant="ghost">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-[10px] bg-[#eef3ff] px-[14px] py-[7px] text-[13px] font-bold text-[#2f6bf3]">{summary?.verify ?? 0} Verify</Badge>
          <Badge className="rounded-[10px] bg-[#fdeaea] px-[14px] py-[7px] text-[13px] font-bold text-[#dc2626]">2 Stat</Badge>
          <Badge className="rounded-[10px] bg-[#fff6e0] px-[14px] py-[7px] text-[13px] font-bold text-[#b9810a]">{summary?.pending ?? 0} Pending</Badge>
        </div>

        <div className="flex-1" />

        <div className="hidden items-center gap-2 font-mono text-[20px] font-semibold tracking-[0.04em] text-[#26344a] sm:flex">
          <Clock3 className="h-[18px] w-[18px] text-[#9aa7b8]" />
          {liveTime}
          <span className="h-2 w-2 rounded-full bg-[#16c172]" />
          <span className="font-sans text-xs font-bold tracking-[0.08em] text-[#16a35e]">LIVE</span>
        </div>
        <div className="relative min-w-0 sm:w-72">
          <Search className="absolute left-[13px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#9aa7b8]" />
          <Input className="h-11 rounded-xl border-[1.5px] border-[#e1e7ef] bg-[#f8fafc] pl-10 text-sm shadow-none" placeholder="ค้นหา VN, HN, ชื่อผู้ป่วย" value={search} onChange={(event) => onSearch(event.target.value)} />
        </div>
        <Button className="hidden lg:inline-flex" onClick={onLogout} variant="ghost">
          <LogOut className="h-4 w-4" />
          ออก
        </Button>
      </div>
    </header>
  );
}
