"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Camera, Check, ChevronRight } from "lucide-react";
import type { PublicDemo } from "@/lib/demo-templates";
import { cn } from "./ui";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Demo Engine v1: dve obrazovky z jedného segment templatu.
 *   1. ZÁKAZNÍK: dopyt pre segment (reálny názov a verejné služby firmy, inak text šablóny)
 *   2. FIRMA: ten istý dopyt v dashboarde, zmena stavu a notifikácia
 * Komponent dostáva iba verejnú projekciu (PublicDemo), aby sa dal neskôr použiť aj na djweby.sk.
 */
export function DemoPreview({ d }: { d: PublicDemo }) {
  const [sent, setSent] = useState(false);
  const [moved, setMoved] = useState(false);
  const stateLabel = (id: string) => d.dashboard.states.find((s) => s.id === id)?.label ?? id;
  const state = moved ? d.dashboard.to : d.dashboard.from;

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-8 sm:py-12">
      <p className="text-[12px] tracking-[0.14em] text-white/40 uppercase">Ukážka · {d.business.name}</p>
      <h1 className="mt-2 max-w-[640px] text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">
        {d.template === "appointment" ? "Takto by sa k vám zákazník objednal z mobilu." : "Takto by k vám chodil dopyt, keď ho zákazník pošle z mobilu."}
      </h1>
      <p className="mt-2 max-w-[600px] text-[15px] text-white/55">
        Ľavá strana je to, čo vyplní zákazník. Pravá je to, čo hneď uvidíte vy. Hodnoty v dopyte sú ukážkové.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {/* ZÁKAZNÍK */}
        <section className="rounded-[28px] bg-white p-5 text-neutral-900 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] sm:p-6">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-neutral-400 uppercase">Zákazník</p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">{d.customer.title}</h2>
          {d.business.city ? <p className="text-[13px] text-neutral-500">{d.business.city}</p> : null}
          {d.business.services.length ? (
            <p className="mt-2 text-[13px] text-neutral-500">{d.business.services.join(" · ")}</p>
          ) : null}
          <form className="mt-5 space-y-3" onSubmit={(e) => (e.preventDefault(), setSent(true))}>
            {d.customer.fields.map((f) => (
              <label key={f.id} className="block">
                <span className="text-[12px] font-medium text-neutral-500">{f.label}</span>
                {f.type === "files" ? (
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-3 py-2.5 text-[14px] text-neutral-600">
                    <Camera className="size-4" /> {f.example ? `${f.example} fotky pripojené` : "Pridať fotky"}
                  </div>
                ) : f.type === "boolean" ? (
                  <div className="mt-1 flex gap-2">
                    {["Áno", "Nie"].map((v) => (
                      <span key={v} className={cn("rounded-full px-3 py-1.5 text-[13px] ring-1", (f.example ?? "Nie") === v ? "bg-neutral-900 text-white ring-neutral-900" : "ring-neutral-300")}>
                        {v}
                      </span>
                    ))}
                  </div>
                ) : f.type === "select" ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(f.options ?? []).slice(0, 6).map((o) => (
                      <span key={o} className={cn("rounded-full px-3 py-1.5 text-[13px] ring-1", f.example === o ? "bg-neutral-900 text-white ring-neutral-900" : "ring-neutral-300")}>
                        {o}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 rounded-xl bg-neutral-100 px-3 py-2.5 text-[14px] text-neutral-700">
                    {f.type === "contact" ? "Meno a telefón zákazníka" : f.example ? `${f.example}${f.unit ? ` ${f.unit}` : ""}` : <span className="text-neutral-400">—</span>}
                  </div>
                )}
              </label>
            ))}
            <button
              type="submit"
              disabled={sent}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-[15px] font-semibold text-white disabled:bg-green-600"
            >
              {sent ? (
                <>
                  <Check className="size-4" /> Dopyt odoslaný
                </>
              ) : (
                "Odoslať dopyt"
              )}
            </button>
          </form>
        </section>

        {/* FIRMA */}
        <section className="relative rounded-[28px] bg-white/[0.04] p-5 ring-1 ring-inset ring-line sm:p-6">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-white/40 uppercase">Váš prehľad</p>
          <AnimatePresence>
            {sent ? (
              <motion.div
                key="note"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } }}
                className="mt-3 flex items-start gap-2.5 rounded-2xl bg-white/[0.07] p-3 text-[14px] ring-1 ring-inset ring-line"
              >
                <Bell className="mt-0.5 size-4 shrink-0 text-yellow-200" />
                <span>{d.notification}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {d.dashboard.states.map((s) => (
              <span key={s.id} className={cn("rounded-full px-2.5 py-1 text-[12px] ring-1 ring-inset", s.id === state && sent ? "bg-white text-black ring-white" : "text-white/45 ring-line")}>
                {s.label}
              </span>
            ))}
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: 0.1 } }}
              className="mt-4 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-inset ring-line"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold tracking-[0.1em] text-white/50 uppercase">{stateLabel(state)}</span>
                <span className="text-[12px] text-white/35">práve teraz</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-[15px]">
                {d.dashboard.inquiry.map((x) => (
                  <li key={x.label} className="flex justify-between gap-3">
                    <span className="text-white/45">{x.label}</span>
                    <span className="text-right text-white/90">{x.value}</span>
                  </li>
                ))}
              </ul>
              {!moved ? (
                <button onClick={() => setMoved(true)} className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-[14px] font-semibold text-black">
                  Posunúť na: {stateLabel(d.dashboard.to)} <ChevronRight className="size-4" />
                </button>
              ) : (
                <p className="mt-4 text-[13px] text-green-300/85">
                  {stateLabel(d.dashboard.from)} → {stateLabel(d.dashboard.to)}. Zákazník môže dostať potvrdenie automaticky.
                </p>
              )}
            </motion.div>
          ) : (
            <p className="mt-6 text-[14px] text-white/40">Odošlite dopyt vľavo a uvidíte, ako príde sem.</p>
          )}
        </section>
      </div>
    </div>
  );
}
