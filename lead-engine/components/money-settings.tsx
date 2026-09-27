"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { markPaidAction, saveSettingsAction } from "@/app/leady/actions";
import type { Settings } from "@/lib/types";
import { Button, inputClass, cn } from "./ui";

const PKG: [keyof Settings["package"], string][] = [
  ["pages", "Počet stránok"],
  ["texts", "Texty"],
  ["images", "Obrázky"],
  ["form", "Formulár"],
  ["domain", "Doména"],
  ["hosting", "Hosting"],
  ["edits", "Úpravy"],
  ["maintenance", "Následná správa"],
  ["delivery", "Termín dodania"],
];

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/** Pravidlo odmeny a obsah balíka. Nič sa nevymýšľa — prázdne = NEEDS CONFIGURATION. */
export function MoneySettings({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const c = s.compensation;
  const setC = (patch: Partial<Settings["compensation"]>) => setS({ ...s, compensation: { ...c, ...patch } });
  const setP = (k: keyof Settings["package"], v: string) =>
    setS({ ...s, package: { ...s.package, [k]: k === "price" ? numOrNull(v) : v || null } });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[14px] font-medium">Odmena volajúceho</div>
        <p className="mt-1 text-[13px] text-white/45">Kým pravidlo nezadáš, volajúci nevidí žiadne sumy — iba počty.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              [null, "Nenastavené"],
              ["handoff", "Za súhlas (handoff)"],
              ["sale", "Za zaplatený predaj"],
              ["both", "Kombinácia"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setC({ model: v })}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] ring-1 ring-inset",
                c.model === v ? "bg-white text-black ring-white" : "text-white/65 ring-line",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {c.model === "handoff" || c.model === "both" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-[13px] text-white/55">
              Suma za handoff (€)
              <input
                type="number"
                value={c.handoff_amount ?? ""}
                onChange={(e) => setC({ handoff_amount: numOrNull(e.target.value) })}
                className={cn(inputClass, "mt-1")}
              />
            </label>
            <label className="text-[13px] text-white/55">
              Nárok vzniká
              <select
                value={c.handoff_condition ?? ""}
                onChange={(e) => setC({ handoff_condition: (e.target.value || null) as Settings["compensation"]["handoff_condition"] })}
                className={cn(inputClass, "mt-1")}
              >
                <option value="">— vyber —</option>
                <option value="on_consent">hneď pri súhlase</option>
                <option value="on_contacted">keď sa Dominik dovolá (súhlas potvrdený)</option>
                <option value="on_interest">keď Dominik zistí skutočný záujem</option>
              </select>
            </label>
          </div>
        ) : null}
        {c.model === "sale" || c.model === "both" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-[13px] text-white/55">
              Suma za zaplatený predaj (€)
              <input
                type="number"
                value={c.sale_amount ?? ""}
                onChange={(e) => setC({ sale_amount: numOrNull(e.target.value), sale_percent: null })}
                className={cn(inputClass, "mt-1")}
              />
            </label>
            <label className="text-[13px] text-white/55">
              alebo % z ceny
              <input
                type="number"
                value={c.sale_percent ?? ""}
                onChange={(e) => setC({ sale_percent: numOrNull(e.target.value), sale_amount: null })}
                className={cn(inputClass, "mt-1")}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div>
        <div className="text-[14px] font-medium">Čo klient dostane za cenu ponuky</div>
        <p className="mt-1 text-[13px] text-white/45">Prázdne polia = NEEDS CONFIGURATION. Volajúci aj scenár ich nesľubujú.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[13px] text-white/55">
            Cena (€)
            <input type="number" value={s.package.price ?? ""} onChange={(e) => setP("price", e.target.value)} className={cn(inputClass, "mt-1")} />
          </label>
          {PKG.map(([k, l]) => (
            <label key={k} className="text-[13px] text-white/55">
              {l}
              <input
                value={(s.package[k] as string | null) ?? ""}
                placeholder="NEEDS CONFIGURATION"
                onChange={(e) => setP(k, e.target.value)}
                className={cn(inputClass, "mt-1")}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveSettingsAction(s);
              setMsg(r);
              if (r.ok) router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Uložiť
        </Button>
        {msg ? <span className={cn("text-[13px]", msg.ok ? "text-green-300" : "text-red-300")}>{msg.message}</span> : null}
      </div>
    </div>
  );
}

export function MarkPaid({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await markPaidAction(id);
            if (!r.ok) setErr(r.message);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Vyplatené
      </Button>
      {err ? <span className="ml-2 text-[12px] text-red-300">{err}</span> : null}
    </span>
  );
}
