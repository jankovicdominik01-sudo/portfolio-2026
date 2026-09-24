import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NEXT_ACTIONS, categoryOf, type LeadWithCompany, type NextAction } from "@/lib/types";
import { fmtRelative, isDue } from "@/lib/format";
import { PriorityTag, StatusPill, cn } from "./ui";

/** Jeden riadok leadu: firma + ďalší krok. Žiadna tabuľka so 40 stĺpcami. */
export function LeadRow({ lead, showStatus = false }: { lead: LeadWithCompany; showStatus?: boolean }) {
  const c = lead.company;
  const cat = categoryOf(c.category);
  const na = lead.next_action ? NEXT_ACTIONS[lead.next_action as NextAction] : null;
  const due = lead.next_action_at && !isDue(lead.next_action_at) ? fmtRelative(lead.next_action_at) : null;
  return (
    <Link
      href={`/leady/leads/${lead.id}`}
      className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-white/[0.035] sm:px-4"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-lg ring-1 ring-inset ring-line">
        {cat.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium tracking-tight">{c.name}</span>
          {lead.priority === "hot" ? <PriorityTag priority="hot" /> : null}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-white/40">
          {[c.city, cat.label, c.phone].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="hidden shrink-0 text-right sm:block">
        {showStatus ? <StatusPill status={lead.status} /> : null}
        {!showStatus && na ? (
          <span className={cn("text-[13px]", due ? "text-white/35" : "text-white/70")}>
            {na.icon} {na.label}
            {due ? <span className="ml-1.5 text-white/30">· {due}</span> : null}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/50" />
    </Link>
  );
}
