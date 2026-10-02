"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { adsCheckAction, createDemoAction, enrichOpportunityAction, refreshOpportunityAction, setDemoDisabledAction } from "@/app/leady/actions";
import { opportunityState, type Opportunity } from "@/lib/opportunity";
import { leakWithVolume } from "@/lib/money-leak";
import { MODULES } from "@/lib/segments";
import type { ChannelDecision } from "@/lib/channel";
import type { Draft } from "@/lib/style";
import { Button, Eyebrow, Section, inputClass, cn } from "./ui";

const LEVEL_TONE: Record<string, string> = {
  HIGH: "bg-green-400/15 text-green-200 ring-green-400/30",
  MEDIUM: "bg-sky-400/15 text-sky-100 ring-sky-400/30",
  LOW: "bg-white/[0.06] text-white/55 ring-line",
  UNKNOWN: "bg-white/[0.03] text-white/40 ring-line",
  VERIFIED: "bg-green-400/15 text-green-200 ring-green-400/30",
  OBSERVED: "bg-sky-400/15 text-sky-100 ring-sky-400/30",
  ESTIMATE: "bg-yellow-400/15 text-yellow-100 ring-yellow-400/30",
};

const DIM_LABEL: Record<string, string> = {
  PROCESS_PAIN: "Ručný proces",
  AUTOMATION_FIT: "Fit na systém",
  BUSINESS_ACTIVITY: "Aktivita firmy",
  EVIDENCE_QUALITY: "Kvalita dôkazov",
  VISUAL_GAP: "Stav webu",
  AD_SPEND_SIGNAL: "Reklama",
  DEMO_POTENTIAL: "Potenciál dema",
};
const DIM_ORDER = ["PROCESS_PAIN", "AUTOMATION_FIT", "BUSINESS_ACTIVITY", "EVIDENCE_QUALITY", "VISUAL_GAP", "AD_SPEND_SIGNAL", "DEMO_POTENTIAL"] as const;

function Badge({ level }: { level: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold tracking-[0.06em] ring-1 ring-inset", LEVEL_TONE[level] ?? LEVEL_TONE.UNKNOWN)}>
      {level}
    </span>
  );
}

function Ref({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return <span className="ml-1.5 text-[11px] text-white/35 tabular-nums">{ids.join(" ")}</span>;
}

export type OpportunityPanelProps = {
  leadId: string;
  /** Uložený JSON (READY / ANALYZING / FAILED / starý v1 / null). */
  stored: unknown;
  channel: ChannelDecision | null;
  drafts: { email: Draft; sms: Draft; demo_url: string | null } | null;
  demo: { code: string; expires_at: string; segment?: string; disabled?: boolean } | null;
};

/**
 * OPPORTUNITY na detaile leadu (admin): prečo, čo sme videli, pravdepodobný proces,
 * pain, odporúčaný systém, Money Leak bez eur, evidence, demo, kanál. Nič sa neodosiela.
 */
export function OpportunityPanel(p: OpportunityPanelProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (r.message ?? "Hotovo.") : (r.error ?? r.message ?? "Chyba."));
      router.refresh();
    });
  const state = opportunityState(p.stored);
  const actions = (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(() => refreshOpportunityAction(p.leadId))}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Vyhodnotiť z uložených dát
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => enrichOpportunityAction(p.leadId))}>
        Obohatiť z webu (ranná rutina)
      </Button>
    </div>
  );

  if (state !== "READY") {
    const failed = p.stored as { error?: string } | null;
    return (
      <Section icon="🧭" title={`Opportunity · ${state}`}>
        <p className="text-[15px] text-white/60">
          {state === "ANALYZING"
            ? "Čaká na rannú rutinu: web sa znova prečíta a príležitosť sa prepočíta."
            : state === "FAILED"
              ? `Analýza zlyhala: ${failed?.error ?? "neznáma chyba"}. Lead funguje ďalej.`
              : "Lead ešte neprešiel Opportunity Engine v2."}
        </p>
        {actions}
        {msg ? <p className="mt-3 text-[13px] text-white/55">{msg}</p> : null}
      </Section>
    );
  }
  const o = p.stored as Opportunity;
  const sys = o.recommended_system;

  return (
    <Section
      icon="🧭"
      title={`Opportunity · ${o.priority}`}
      aside={
        <button className="text-sm text-white/45 hover:text-white" disabled={pending} onClick={() => run(() => refreshOpportunityAction(p.leadId))}>
          Prepočítať
        </button>
      }
    >
      {/* WHY THIS LEAD */}
      <Eyebrow>Prečo tento lead</Eyebrow>
      <div className="mt-1.5 space-y-1">
        {o.why_lines.length ? (
          o.why_lines.map((w) => (
            <p key={w.text} className="text-[17px] leading-snug font-medium">
              {w.text}
              <Ref ids={w.evidence_ids} />
            </p>
          ))
        ) : (
          <p className="text-[17px] text-white/60">{o.why_this_lead}</p>
        )}
      </div>

      <p className={cn("mt-3 inline-flex rounded-full px-3 py-1 text-[12px] ring-1 ring-inset", o.call_reason?.type === "PROCESS" ? "bg-green-400/10 text-green-200 ring-green-400/30" : o.call_reason?.type === "WEB_SYSTEM" ? "bg-sky-400/10 text-sky-100 ring-sky-400/30" : "text-white/50 ring-line")}>
        {o.call_reason?.label ?? "Dôvod hovoru neurčený"}
      </p>
      {o.call_reason?.unknown.length ? (
        <ul className="mt-2 space-y-0.5 text-[13px] text-yellow-100/80">
          {o.call_reason.unknown.map((u) => (
            <li key={u}>? {u}</li>
          ))}
        </ul>
      ) : null}

      {o.web_gaps?.length ? (
        <>
          <Eyebrow className="mt-6">Medzery webu (nie ručný proces)</Eyebrow>
          <ul className="mt-2 space-y-2">
            {o.web_gaps.map((g) => (
              <li key={g.code} className="flex items-start gap-2">
                <Badge level={g.level} />
                <span className="text-[15px] text-white/85">
                  {g.label}
                  <Ref ids={g.evidence_ids} />
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* WHAT WE OBSERVED */}
      <Eyebrow className="mt-6">Ručný proces: čo sme videli</Eyebrow>
      {o.pains.length ? (
        <ul className="mt-2 space-y-2">
          {o.pains.map((pain) => (
            <li key={pain.code} className="flex items-start gap-2">
              <Badge level={pain.level} />
              <span className="text-[15px] text-white/85">
                {pain.label}
                {pain.hypothesis ? <span className="text-yellow-200/80"> · hypotéza, potvrdiť v hovore</span> : null}
                <Ref ids={pain.evidence_ids} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-[14px] text-white/50"><Badge level="UNKNOWN" /> Konkrétny ručný proces sme na webe nevideli.</p>
      )}

      {/* LIKELY MANUAL PROCESS */}
      <Eyebrow className="mt-6">Pravdepodobný proces</Eyebrow>
      {o.process_model.steps.length ? (
        <>
          <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-[14px]">
            <li className="text-white/50">zákazník</li>
            {o.process_model.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="text-white/30">→</span>
                <span className={s.actor === "company" ? "text-sky-100" : "text-white/85"}>
                  {s.actor === "company" ? `firma ${s.text}` : s.text}
                </span>
                <Ref ids={s.evidence_ids} />
              </li>
            ))}
          </ol>
          <p className="mt-1.5 flex items-center gap-2 text-[12px] text-white/45">
            <Badge level={o.process_model.level} /> {o.process_model.note}
          </p>
        </>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-[14px] text-white/50">
          <Badge level="UNKNOWN" /> {o.process_model.note}
        </p>
      )}

      {/* RECOMMENDED SYSTEM */}
      <Eyebrow className="mt-6">Odporúčaný systém</Eyebrow>
      {sys ? (
        <div className="mt-2">
          <p className="text-[17px] font-medium">
            {sys.label}
            {sys.basis === "segment" ? <span className="ml-2 text-[13px] font-normal text-yellow-200/80">hypotéza segmentu</span> : null}
          </p>
          <ul className="mt-1.5 space-y-1 text-[13px] text-white/60">
            {sys.primary_modules.map((m) => (
              <li key={m}>• {MODULES[m].label}: {MODULES[m].what}</li>
            ))}
          </ul>
          {sys.optional_modules.length ? (
            <p className="mt-1.5 text-[13px] text-white/45">Voliteľne: {sys.optional_modules.map((m) => MODULES[m].label).join(", ")}</p>
          ) : null}
          <ul className="mt-2 space-y-0.5 text-[12px] text-white/40">
            {sys.reasoning.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-[14px] text-white/50">Pre tento segment zatiaľ nemáme šablónu systému.</p>
      )}

      {/* DIMENSIONS */}
      <Eyebrow className="mt-6">Dimenzie</Eyebrow>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {DIM_ORDER.map((k) => {
          const d = o.dimensions[k];
          return (
            <div key={k} className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-inset ring-line">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-white/55">{DIM_LABEL[k]}</span>
                <Badge level={d.level} />
              </div>
              <p className="mt-1 text-[13px] text-white/70">
                {d.reason}
                <Ref ids={d.evidence_ids} />
              </p>
            </div>
          );
        })}
      </div>

      <MoneyLeak o={o} />

      {/* EVIDENCE */}
      <details className="group mt-6 rounded-2xl bg-white/[0.02] ring-1 ring-inset ring-line">
        <summary className="cursor-pointer list-none px-4 py-3 text-[14px] text-white/60">Evidence ({o.evidence.length}) · pravidlá v{o.versions.opportunity_engine}</summary>
        <ul className="space-y-2 px-4 pb-4">
          {o.evidence.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-[13px]">
              <span className="w-7 shrink-0 text-white/35 tabular-nums">{e.id}</span>
              <Badge level={e.level} />
              <div className="min-w-0">
                <p className="text-white/80">{e.text}</p>
                {e.excerpt && e.excerpt !== e.text ? <p className="break-words text-white/40">„{e.excerpt}“</p> : null}
                <p className="text-[11px] text-white/30">
                  {e.code} · istota {e.confidence}
                  {e.observed_at ? ` · ${e.observed_at.slice(0, 10)}` : ""}
                  {e.source && /^https?:/.test(e.source) ? (
                    <a href={e.source} target="_blank" rel="noopener noreferrer" className="ml-1 underline">zdroj</a>
                  ) : e.source ? ` · ${e.source}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="px-4 pb-4 text-[11px] text-white/30">
          segment {o.versions.segment_template} · money leak {o.versions.money_leak} · signály {o.versions.process_signals} · {o.analyzed_at.slice(0, 16).replace("T", " ")}
        </p>
      </details>

      {/* DEMO */}
      <Eyebrow className="mt-6">Demo · potenciál {o.dimensions.DEMO_POTENTIAL.level}</Eyebrow>
      {p.demo ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[14px]">
          <a href={`/leady/demo/${p.demo.code}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white/85 underline underline-offset-2">
            Otvoriť náhľad <ExternalLink className="size-3.5" />
          </a>
          <span className="text-white/40">{p.demo.disabled ? "vypnuté" : `platí do ${p.demo.expires_at.slice(0, 10)}`}</span>
          <button className="text-white/45 hover:text-white" disabled={pending} onClick={() => run(() => setDemoDisabledAction(p.leadId, !p.demo?.disabled))}>
            {p.demo.disabled ? "Zapnúť" : "Vypnúť"}
          </button>
          <span className="basis-full text-[12px] text-white/40">Nič sa neodosiela. Odkaz posiela iba Dominik ručne.</span>
        </div>
      ) : sys ? (
        <div className="mt-2">
          <p className="text-[13px] text-white/50">{o.dimensions.DEMO_POTENTIAL.reason}</p>
          <Button
            className="mt-2"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => createDemoAction(p.leadId, o.dimensions.DEMO_POTENTIAL.level === "LOW"))}
          >
            {o.dimensions.DEMO_POTENTIAL.level === "LOW" ? "Vytvoriť demo napriek LOW" : "Vytvoriť demo"}
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-[14px] text-white/45">Pre tento segment zatiaľ nemáme šablónu.</p>
      )}

      {p.channel ? (
        <>
          <Eyebrow className="mt-6">
            {p.channel.channel === "CALL" ? "Prečo hovor" : p.channel.channel === "HOLD" ? "Prečo čaká" : "Prečo async"}: {p.channel.channel}
            {p.channel.operator_id ? ` → ${p.channel.operator_id}` : ""}
          </Eyebrow>
          <p className="mt-1 text-[13px] text-white/50">{p.channel.reasons[0]}</p>
          <ul className="mt-2 space-y-1 text-[14px]">
            {p.channel.rules.map((r) => (
              <li key={r.key} className={r.passed ? "text-green-300/85" : "text-white/45"}>
                {r.passed ? "✓" : "✗"} {r.label}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <AdsCheck leadId={p.leadId} status={o.ads.status} note={o.ads.note} run={run} pending={pending} />

      {p.drafts ? (
        <div className="mt-6 space-y-4">
          <Eyebrow>Návrh správy (iba na skopírovanie, nič sa neodosiela)</Eyebrow>
          <DraftBox label="E-mail" d={p.drafts.email} />
          <DraftBox label={`SMS · ${p.drafts.sms.sms_segments} seg.`} d={p.drafts.sms} />
        </div>
      ) : null}

      {msg ? <p className="mt-4 text-[13px] text-white/55">{msg}</p> : null}
      <div className="mt-6 border-t border-line pt-4">{actions}</div>
    </Section>
  );
}

const range = (r: readonly [number, number], unit: string) => (r[0] === r[1] ? `${r[0]} ${unit}` : `${r[0]} až ${r[1]} ${unit}`);

/** Money Leak: ručná práca, nie strata. Čísla iba z predpokladov, s počtom dopytov od Dominika. */
function MoneyLeak({ o }: { o: Opportunity }) {
  const m = o.money_leak;
  const [n, setN] = useState("");
  const [hv, setHv] = useState("");
  const perWeek = Number(n.replace(",", "."));
  const hourly = Number(hv.replace(",", "."));
  const calc = n && Number.isFinite(perWeek) && perWeek >= 0 ? leakWithVolume(m, perWeek, hv ? hourly : null) : null;
  return (
    <div className="mt-6 rounded-3xl bg-white/[0.03] p-4 ring-1 ring-inset ring-line">
      <Eyebrow>Money Leak (ručná práca, nie strata)</Eyebrow>
      <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[14px]">
        <dt className="text-white/45">Proces</dt>
        <dd className="text-white/85">{m.process.length ? m.process.join(" → ") : "UNKNOWN"}</dd>
        <dt className="text-white/45">Fit</dt>
        <dd><Badge level={m.automation_fit} /></dd>
        <dt className="text-white/45">Odporúčané</dt>
        <dd className="text-white/85">{m.recommended.join(" + ") || "—"}</dd>
        <dt className="text-white/45">Odhad</dt>
        <dd className="text-white/85">
          {m.estimate ? (
            <span className="inline-flex items-center gap-2">
              <Badge level="ESTIMATE" /> {range(m.estimate.value, "min / dopyt")}
            </span>
          ) : (
            <span className="text-white/50">{m.estimate_note}</span>
          )}
        </dd>
        {m.estimate ? (
          <>
            <dt className="text-white/45">Predpoklady</dt>
            <dd className="text-[13px] text-white/60">{m.estimate.assumptions.join(" · ")}</dd>
          </>
        ) : null}
        <dt className="text-white/45">Dopyty / týždeň</dt>
        <dd className="text-white/50">UNKNOWN (nevieme, kým to nepovie firma)</dd>
      </dl>
      {m.estimate ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
          <input className={cn(inputClass, "h-9 w-36 text-[14px]")} inputMode="decimal" placeholder="dopytov / týždeň" value={n} onChange={(e) => setN(e.target.value)} />
          <input className={cn(inputClass, "h-9 w-40 text-[14px]")} inputMode="decimal" placeholder="hodnota hodiny (voliteľné)" value={hv} onChange={(e) => setHv(e.target.value)} />
          {calc ? (
            <p className="basis-full text-[13px] text-white/75">
              <Badge level="ESTIMATE" /> {range(calc.minutes_per_week, "min týždenne")} · {range(calc.hours_per_year, "h ročne")}
              {calc.value_per_year === "UNKNOWN" ? " · hodnota UNKNOWN (bez hodinovej sadzby)" : ` · ${range(calc.value_per_year, "(tvoja sadzba × hodiny)")}`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DraftBox({ label, d }: { label: string; d: Draft }) {
  const [copied, setCopied] = useState(false);
  const blocked = d.issues.length > 0;
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-line">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-white/55">{label}</span>
        <button
          disabled={blocked}
          onClick={async () => {
            await navigator.clipboard.writeText(d.text);
            setCopied(true);
          }}
          className={cn("inline-flex items-center gap-1 text-[13px]", blocked ? "text-white/25" : "text-white/60 hover:text-white")}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Kopírovať
        </button>
      </div>
      <pre className="mt-2 whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-white/85">{d.text}</pre>
      {blocked ? (
        <ul className="mt-2 text-[12px] text-red-300/85">
          {d.issues.map((i) => (
            <li key={i}>✗ {i}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-green-300/70">✓ Guard OK · variant {d.variant}</p>
      )}
    </div>
  );
}

function AdsCheck({
  leadId,
  status,
  note,
  run,
  pending,
}: {
  leadId: string;
  status: string;
  note: string;
  run: (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => void;
  pending: boolean;
}) {
  const [url, setUrl] = useState("");
  return (
    <div className="mt-6">
      <Eyebrow>Reklama: {status.replace("_", " ")} · spend UNKNOWN</Eyebrow>
      <p className="mt-1 text-[13px] text-white/50">{note}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          className={cn(inputClass, "h-9 min-w-0 flex-1 text-[14px]")}
          placeholder="Odkaz z Transparency Center / Ad Library"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button size="sm" variant="secondary" disabled={pending || !url} onClick={() => run(() => adsCheckAction(leadId, { status: "ACTIVE", url }))}>
          Reklama beží
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => adsCheckAction(leadId, { status: "NOT_FOUND", url: url || null }))}>
          Nenašiel som
        </Button>
      </div>
    </div>
  );
}
