import type { LeadEvent } from "@/lib/types";
import { fmtDate, fmtTime } from "@/lib/format";
import { cn } from "./ui";

const DOT: Record<LeadEvent["kind"], string> = {
  created: "bg-white/40",
  merged: "bg-white/40",
  analysis: "bg-info",
  status: "bg-white/40",
  call: "bg-white/70",
  handoff: "bg-ok",
  dominik_call: "bg-brand",
  note: "bg-white/40",
  archive: "bg-white/25",
};

/** Jednoduchá timeline, nie audit log. */
export function Timeline({ events }: { events: LeadEvent[] }) {
  if (!events.length) return <p className="text-sm text-white/35">Zatiaľ bez histórie.</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-px before:bg-line">
      {events.map((e) => (
        <li key={e.id} className="relative grid grid-cols-[11px_1fr] gap-3.5">
          <span className={cn("relative mt-1.5 size-[11px] rounded-full ring-4 ring-bg", DOT[e.kind])} />
          <div>
            <div className="text-[14px] leading-snug text-white/85">{e.label}</div>
            <div className="mt-0.5 text-[12px] text-white/35">
              {fmtDate(e.at)} · {fmtTime(e.at)} · {e.actor}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
