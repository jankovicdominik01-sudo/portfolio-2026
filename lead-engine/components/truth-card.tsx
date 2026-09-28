"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, ShieldAlert } from "lucide-react";
import { feedbackAction } from "@/app/leady/actions";
import type { TruthCard } from "@/lib/script";
import { FEEDBACK_KINDS, FEEDBACK_LABEL, type FeedbackKind } from "@/lib/types";
import { cn, inputClass } from "./ui";

const WEB_TONE: Record<string, string> = {
  confirmed: "text-green-300",
  probable: "text-sky-200",
  no_website_found: "text-yellow-200",
  uncertain: "text-yellow-200",
};
const TIER_TONE: Record<string, string> = {
  gold: "bg-yellow-400/15 text-yellow-100 ring-yellow-300/30",
  silver: "bg-white/[0.08] text-white/80 ring-white/20",
  research: "bg-red-500/10 text-red-200 ring-red-400/20",
};

/** Čo o firme VIEME a čo NEVIEME — volajúci nemá potrebu otvárať Google. */
export function TruthPanel({ t }: { t: TruthCard }) {
  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className={cn("rounded-full px-2.5 py-1 font-semibold ring-1 ring-inset", TIER_TONE[t.data_quality.tier])}>
          Dáta: {t.data_quality.label}
        </span>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-white/60 ring-1 ring-inset ring-line">{t.country}</span>
        <span className={cn("rounded-full bg-white/[0.05] px-2.5 py-1 ring-1 ring-inset ring-line", t.category.verified ? "text-white/70" : "text-yellow-200")}>
          {t.category.label}
          {t.category.verified ? "" : " · neoverené"}
        </span>
      </div>

      <Section label="Čo reálne robia">
        <p className={cn("text-[16px] leading-snug", t.does.verified ? "text-white/90" : "text-yellow-100/90")}>{t.does.text}</p>
        {t.does.sources.length ? <p className="mt-1 text-[12px] text-white/40">Zdroj: {t.does.sources.join(", ")}</p> : null}
      </Section>

      <Section label="Web">
        <p className={cn("text-[16px] font-medium", WEB_TONE[t.web.status])}>
          {t.web.label}
          {t.web.domain ? (
            <>
              {" · "}
              <a href={t.web.url ?? `https://${t.web.domain}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {t.web.domain}
              </a>
            </>
          ) : null}
        </p>
        {t.web.issues.length ? (
          <ul className="mt-1.5 space-y-0.5 text-[13px] text-white/60">
            {t.web.issues.map((i) => (
              <li key={i}>• {i}</li>
            ))}
          </ul>
        ) : null}
      </Section>

      {t.socials.length ? (
        <Section label="Social">
          <div className="flex flex-wrap gap-2">
            {t.socials.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] ring-1 ring-inset ring-line">
                {s.label}
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      <Section label="Prečo voláme">
        {t.why_calling.length ? (
          <ul className="space-y-1 text-[16px] leading-snug font-medium">
            {t.why_calling.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-yellow-200">Bez jasného dôvodu — pýtaj sa.</p>
        )}
      </Section>

      <Section label="Uhol hovoru">
        <p className="text-[16px] leading-snug">„{t.angle}“</p>
      </Section>

      {t.why_trust.length ? (
        <Section label="Prečo tomu veríme">
          <ul className="space-y-0.5 text-[13px] text-white/60">
            {t.why_trust.map((w) => (
              <li key={w}>✓ {w}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {t.dont_say.length ? (
        <div className="rounded-2xl bg-red-500/[0.06] p-4 ring-1 ring-inset ring-red-400/20">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-red-200/80 uppercase">
            <ShieldAlert className="size-3.5" /> Čo nehovoriť
          </div>
          <ul className="space-y-1 text-[14px] text-red-100/85">
            {t.dont_say.map((d) => (
              <li key={d}>• {d}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {t.phone.value && t.phone.confidence !== "high" ? (
        <p className="text-[12px] text-yellow-200/80">Telefón: {t.phone.sources.join(", ") || "jeden zdroj"} — over si, že voláš správnej firme.</p>
      ) : null}
      {t.data_quality.why.length ? <p className="text-[12px] text-white/40">Neisté: {t.data_quality.why.join(" · ")}</p> : null}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-line">
      <div className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-white/40 uppercase">{label}</div>
      {children}
    </div>
  );
}

/** Rýchla spätná väzba: opravuje dáta a zlepšuje engine reálnymi hovormi. */
export function FeedbackBox({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = () => {
    if (!kind) return;
    start(async () => {
      const r = await feedbackAction(leadId, { kind, url: url || null, note: note || null });
      setMsg(r.message);
      if (r.ok) {
        setKind(null);
        setUrl("");
        setNote("");
      }
    });
  };
  return (
    <div className="mt-4 rounded-2xl bg-white/[0.02] ring-1 ring-inset ring-line">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[14px] text-white/55">
        Nesedí niečo v dátach? Nahlás to
        <span className="text-white/35">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="space-y-3 px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-left text-[13px] leading-tight ring-1 ring-inset",
                  kind === k ? "bg-white/15 ring-white/40" : "bg-white/[0.04] ring-line",
                )}
              >
                {FEEDBACK_LABEL[k]}
              </button>
            ))}
          </div>
          {kind === "has_other_web" ? (
            <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Adresa webu (ak ju povedali)" inputMode="url" />
          ) : null}
          {kind ? <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Poznámka (voliteľné)" /> : null}
          {kind ? (
            <button
              onClick={send}
              disabled={pending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/90 text-[15px] font-semibold text-black"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Odoslať
            </button>
          ) : null}
          {msg ? <p className="text-[13px] text-white/60">{msg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
