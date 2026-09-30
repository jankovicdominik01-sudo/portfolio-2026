"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { adsCheckAction, createDemoAction, refreshOpportunityAction } from "@/app/leady/actions";
import type { Opportunity } from "@/lib/opportunity";
import type { ChannelDecision } from "@/lib/channel";
import type { Draft } from "@/lib/style";
import { Button, Eyebrow, Section, inputClass, cn } from "./ui";

const LEVEL_TONE: Record<string, string> = {
  HIGH: "text-green-300",
  MEDIUM: "text-sky-200",
  LOW: "text-white/45",
  UNKNOWN: "text-white/35",
  VERIFIED: "text-green-300",
  OBSERVED: "text-sky-200",
  ESTIMATE: "text-yellow-200",
};

const DIM_LABEL: Record<string, string> = {
  PROCESS_PAIN: "Ručný proces",
  BUSINESS_ACTIVITY: "Aktivita firmy",
  EVIDENCE_QUALITY: "Kvalita dôkazov",
  AUTOMATION_FIT: "Fit na systém",
  VISUAL_GAP: "Stav webu",
  AD_SPEND_SIGNAL: "Reklama",
  DEMO_POTENTIAL: "Potenciál dema",
};

export type OpportunityPanelProps = {
  leadId: string;
  opportunity: Opportunity | null;
  channel: ChannelDecision | null;
  drafts: { email: Draft; sms: Draft; demo_url: string | null } | null;
  demo: { code: string; expires_at: string; template: string } | null;
};

/**
 * Opportunity Engine na detaile leadu: dimenzie s dôvodmi, Money Leak, kanál
 * s pravidlami, demo a návrhy správ. Nič sa odtiaľto neodosiela.
 */
export function OpportunityPanel(p: OpportunityPanelProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (r.message ?? "Hotovo.") : (r.error ?? "Chyba."));
      router.refresh();
    });

  if (!p.opportunity) {
    return (
      <Section icon="🧭" title="Príležitosť">
        <p className="text-[15px] text-white/60">Lead ešte neprešiel Opportunity Engine.</p>
        <Button className="mt-4" size="sm" disabled={pending} onClick={() => run(() => refreshOpportunityAction(p.leadId))}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Vyhodnotiť príležitosť
        </Button>
      </Section>
    );
  }
  const o = p.opportunity;

  return (
    <Section
      icon="🧭"
      title={`Príležitosť ${o.priority}`}
      aside={
        <button className="text-sm text-white/45 hover:text-white" disabled={pending} onClick={() => run(() => refreshOpportunityAction(p.leadId))}>
          Prepočítať
        </button>
      }
    >
      <p className="text-[17px] leading-snug font-medium">{o.why_this_lead}</p>
      {o.recommended_system ? <p className="mt-1.5 text-[14px] text-white/55">Návrh: {o.recommended_system.label}</p> : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {Object.entries(o.dimensions).map(([k, d]) => (
          <div key={k} className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-inset ring-line">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-white/55">{DIM_LABEL[k] ?? k}</span>
              <span className={cn("text-[12px] font-semibold tracking-wide", LEVEL_TONE[d.level])}>{d.level}</span>
            </div>
            <p className="mt-1 text-[13px] text-white/70">{d.reasons[0] ?? "nevieme"}</p>
          </div>
        ))}
      </div>

      <Eyebrow className="mt-6">Money Leak (bez eur)</Eyebrow>
      <ul className="mt-2 space-y-1.5">
        {o.money_leak.map((l, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
            <span className="w-[74px] shrink-0 text-[11px] tracking-wide text-white/35">{l.area}</span>
            <span className="text-white/80">{l.label}</span>
            <span className={cn("text-[12px]", LEVEL_TONE[l.level])}>{l.level}</span>
            {l.value && l.value !== l.label ? <span className="basis-full pl-[82px] text-[12px] text-white/40">„{l.value}“</span> : null}
          </li>
        ))}
      </ul>

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

      <Eyebrow className="mt-6">Demo</Eyebrow>
      {p.demo ? (
        <p className="mt-2 text-[14px] text-white/75">
          {p.drafts?.demo_url ?? `/d/${p.demo.code}`} <span className="text-white/40">· platí do {p.demo.expires_at.slice(0, 10)}</span>
        </p>
      ) : o.recommended_system ? (
        <Button className="mt-2" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => createDemoAction(p.leadId))}>
          Vytvoriť demo
        </Button>
      ) : (
        <p className="mt-2 text-[14px] text-white/45">Pre tento segment zatiaľ nemáme šablónu.</p>
      )}

      {p.drafts ? (
        <div className="mt-6 space-y-4">
          <Eyebrow>Návrh správy (iba na skopírovanie, nič sa neodosiela)</Eyebrow>
          <DraftBox label="E-mail" d={p.drafts.email} />
          <DraftBox label={`SMS · ${p.drafts.sms.sms_segments} seg.`} d={p.drafts.sms} />
        </div>
      ) : null}

      {msg ? <p className="mt-4 text-[13px] text-white/55">{msg}</p> : null}
    </Section>
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
