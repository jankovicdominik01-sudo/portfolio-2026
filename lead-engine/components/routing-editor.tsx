"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { saveRoutingAction } from "@/app/leady/actions";
import { CATEGORIES, type CategoryId } from "@/lib/types";
import { Button, cn } from "./ui";

/** Routing segment → volajúci. Predvolené hodnoty sú iba štart; systém routing sám nemení (iba zbiera štatistiky). */
export function RoutingEditor({
  routing,
  defaults,
  callers,
}: {
  routing: Record<string, string | null>;
  defaults: Record<string, string | null>;
  callers: { username: string; name: string }[];
}) {
  const [map, setMap] = useState<Record<string, string | null>>({ ...defaults, ...routing });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const changed = Object.fromEntries(Object.entries(map).filter(([k, v]) => v !== defaults[k])) as Record<CategoryId, string | null>;
      const r = await saveRoutingAction(changed);
      setMsg(r.message);
    });
  return (
    <div>
      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {CATEGORIES.filter((c) => c.id !== "ine").map((c) => (
          <label key={c.id} className="flex items-center justify-between gap-3 border-b border-line/60 py-1.5 text-[14px]">
            <span className="truncate">
              {c.emoji} {c.label}
            </span>
            <select
              value={map[c.id] ?? ""}
              onChange={(e) => setMap({ ...map, [c.id]: e.target.value || null })}
              className={cn(
                "rounded-lg bg-white/[0.06] px-2 py-1 text-[13px] ring-1 ring-inset ring-line",
                map[c.id] !== defaults[c.id] && "ring-yellow-300/50",
              )}
            >
              <option value="">— nikto —</option>
              {callers.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Uložiť routing
        </Button>
        {msg ? <span className="text-[13px] text-white/55">{msg}</span> : null}
      </div>
    </div>
  );
}
