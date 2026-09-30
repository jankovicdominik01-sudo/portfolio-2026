import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { RadarPanel } from "@/components/radar-panel";
import { ArrowLeft, Globe, Mail, Phone } from "lucide-react";
import { requireUser, callers, adminName, allUsers } from "@/lib/auth";
import { db } from "@/lib/db";
import { dominikOpening2 } from "@/lib/script";
import { ISSUE_LABEL } from "@/lib/score";
import { leadSource } from "@/lib/analytics";
import { SalesPanel } from "@/components/sales-panel";
import { getLead, leadDrafts } from "@/lib/leads";
import { OpportunityPanel } from "@/components/opportunity-panel";
import type { Opportunity } from "@/lib/opportunity";
import type { ChannelDecision } from "@/lib/channel";
import { displayUrl, fmtDate, fmtDateTime, telHref } from "@/lib/format";
import {
  ARCHIVE_LABEL,
  DOMINIK_OUTCOME_LABEL,
  NEXT_ACTIONS,
  OUTCOME_LABEL,
  categoryOf,
  type CallOutcome,
  type DominikOutcome,
  type LeadDetail,
  type LeadStatus,
  type NextAction,
  WEBSITE_STATUS_LABEL,
} from "@/lib/types";
import { ButtonLink, Card, CategoryLabel, Eyebrow, PriorityTag, Section, StatusPill, TrustRow } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { CallBrief } from "@/components/call-brief";
import { ClaimList } from "@/components/evidence";
import { Timeline } from "@/components/timeline";
import {
  AnalyzeButton,
  ArchiveControl,
  AssignSelect,
  CompanyEditor,
  NotesEditor,
  StageButtons,
} from "@/components/lead-actions";

import { CallerCall } from "@/components/caller-call";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  // ownCall: volajúci musí vidieť obrazovku „hotovo“ aj po tom, čo lead práve odovzdal Dominikovi.
  const lead = await getLead(user, (await params).id, { ownCall: user.role === "caller" });
  if (!lead) {
    if (user.role === "caller") redirect("/leady");
    notFound();
  }

  if (user.role === "caller") return <CallerCall user={user} leadId={lead.id} backHref="/leady" />;

  const c = lead.company;
  const a = lead.analysis;
  const lastCall = lead.calls[0] ?? null;

  return (
    <div>
      <Link href="/leady/leads" className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white">
        <ArrowLeft className="size-4" /> Leady
      </Link>

      {/* Hlavička */}
      <FadeIn>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={lead.status} />
          <PriorityTag priority={lead.priority} />
          {lead.archive_reason ? (
            <span className="text-xs text-white/40">· {ARCHIVE_LABEL[lead.archive_reason]}</span>
          ) : null}
        </div>
        <h1 className="mt-3 text-[32px] leading-tight font-semibold tracking-[-0.035em] sm:text-[40px]">{c.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <CategoryLabel category={c.category} />
          {c.city ? <span className="text-sm text-white/55">{c.city}</span> : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {c.phone ? (
            <ButtonLink href={telHref(c.phone)!} variant="secondary" size="sm">
              <Phone className="size-3.5" /> {c.phone}
            </ButtonLink>
          ) : null}
          {c.email ? (
            <ButtonLink href={`mailto:${c.email}`} variant="secondary" size="sm">
              <Mail className="size-3.5" /> {c.email}
            </ButtonLink>
          ) : null}
          {c.website ? (
            <ButtonLink href={c.website} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
              <Globe className="size-3.5" /> {displayUrl(c.website)}
            </ButtonLink>
          ) : null}
        </div>
        {a ? <TrustRow trust={lead.trust} className="mt-5" /> : null}
      </FadeIn>

      {/* Stav + ďalší krok — to najdôležitejšie hore */}
      <FadeIn delay={0.06} className="mt-8">
        <StateBanner lead={lead} />
      </FadeIn>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <OpportunityPanel
            leadId={lead.id}
            opportunity={(lead.opportunity as unknown as Opportunity | null) ?? null}
            channel={(lead.channel_decision as unknown as ChannelDecision | null) ?? null}
            drafts={leadDrafts(lead, process.env.DJWEBY_DEMO_BASE ?? "https://djweby.sk")}
            demo={(lead.demo as unknown as { code: string; expires_at: string; template: string } | null) ?? null}
          />
          <RadarPanel lead={lead} />
          {a ? (
            <>
              {a.nothing_found ? (
                <Card className="p-5 text-[15px] text-yellow-100/90 ring-warn/20">
                  <span className="mr-1.5">🟡</span> Nenájdený výrazný problém. {a.why_this_lead}
                </Card>
              ) : null}
              <div className="grid gap-5 md:grid-cols-2">
                <Section icon="👀" title="Čo sme našli">
                  <ClaimList claims={a.observations} evidence={a.evidence} empty="Nenájdený výrazný problém." />
                </Section>
                <Section icon="❤️" title="Čo sa nám páči">
                  <ClaimList
                    claims={a.positive_points}
                    evidence={a.evidence}
                    empty="Nenašli sme konkrétnu pochvalu — doplň ju po pozretí webu."
                  />
                </Section>
              </div>

              <Section icon="🎯" title="Hlavný hook">
                <p className="text-[19px] leading-snug font-medium tracking-[-0.01em]">
                  {a.primary_hook ? `„${a.primary_hook}“` : "Nenájdený — lead nie je urgentný."}
                </p>
                {a.secondary_hook ? (
                  <p className="mt-3 text-[15px] text-white/50">
                    <span className="text-white/35">Záložný:</span> „{a.secondary_hook}“
                  </p>
                ) : null}
              </Section>

              <CallBrief lead={lead} mode="admin" />

              <Section icon="🧠" title="Prečo tento lead" aside={<EngineBadge lead={lead} />}>
                <p className="text-[15px] leading-relaxed text-white/80">{a.why_this_lead}</p>
                <dl className="mt-5 grid gap-4 text-[14px] sm:grid-cols-2">
                  <Info label="Čo firma robí" value={a.company_summary} />
                  <Info label="Čo môže brzdiť kontakt" value={a.customer_risk} />
                  <Info label="Čo môže chýbať zákazníkovi" value={a.customer_gap} />
                  <Info label="Čo vyrieši jednoduchý web" value={a.opportunity} />
                </dl>
                {a.warnings.length ? (
                  <ul className="mt-5 space-y-1.5 rounded-2xl bg-warn/[0.06] p-4 text-[13px] text-yellow-100/80 ring-1 ring-warn/15">
                    {a.warnings.map((w) => (
                      <li key={w}>· {w}</li>
                    ))}
                  </ul>
                ) : null}
                <details className="group mt-5">
                  <summary className="cursor-pointer text-[13px] text-white/40 hover:text-white/70">
                    Zdroje ({a.evidence.length}) · analyzované {fmtDateTime(a.analyzed_at)}
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {a.evidence.map((e) => (
                      <li key={e.id} className="text-[13px] text-white/55">
                        <span className="mr-2 font-mono text-[11px] text-white/30">{e.id}</span>
                        {e.excerpt}
                        {e.url ? (
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-white/30 underline-offset-2 hover:text-white hover:underline"
                          >
                            {e.page ?? displayUrl(e.url)}
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              </Section>
            </>
          ) : null}
        </div>

        {/* Pravý stĺpec: firma, hovor, poznámky, timeline */}
        <div className="space-y-5">
          {lastCall ? (
            <Section icon="☎️" title="Posledný hovor">
              <div className="text-[15px]">
                {lastCall.role === "admin"
                  ? DOMINIK_OUTCOME_LABEL[lastCall.outcome as DominikOutcome]
                  : OUTCOME_LABEL[lastCall.outcome as CallOutcome]}
              </div>
              <div className="mt-1 text-[13px] text-white/40">
                {lastCall.by} · {fmtDateTime(lastCall.created_at)}
              </div>
              {lastCall.company_said || lastCall.note ? (
                <p className="mt-3 text-[14px] leading-relaxed text-white/70">
                  „{lastCall.company_said ?? lastCall.note}“
                </p>
              ) : null}
            </Section>
          ) : null}

          <ScoreBox lead={lead} />

          <Section icon="📝" title="Poznámky">
            <NotesEditor leadId={lead.id} initial={lead.notes} />
          </Section>

          <Section icon="🏢" title="Firma" aside={<CompanyEditor leadId={lead.id} company={c} />}>
            <dl className="space-y-2.5 text-[14px]">
              <Row label="Kontakt" value={c.contact_person} />
              <Row label="Telefón" value={c.phone} />
              <Row label="E-mail" value={c.email} />
              <Row label="Mesto" value={c.city} />
              <Row label="Adresa" value={c.address} />
              <Row label="Web" value={c.website ? displayUrl(c.website) : "nenašli sme"} />
              <Row label="Krajina" value={c.country ?? c.profile?.country ?? null} />
              <Row label="IČO" value={c.ico ?? null} />
              <Row label="Zdroje" value={(c.sources ?? []).map((x) => x.source).join(", ") || leadSource(lead)} />
              <Row label="Volajúci" value={lead.assigned_to} />
              {c.do_not_call ? <Row label="Pozor" value="⛔ Nevolať" /> : null}
              <Row label="Pridané" value={fmtDate(lead.created_at)} />
            </dl>
          </Section>

          <Section icon="🕓" title="História">
            <Timeline events={lead.events} />
          </Section>

          {lead.status !== "archived" ? (
            <div className="px-1">
              <ArchiveControl leadId={lead.id} />
            </div>
          ) : null}
        </div>
      </div>
      {a ? <OfferFootnote has={!!lead.call_brief?.offer} category={c.category} /> : null}
    </div>
  );
}

function StateBanner({ lead }: { lead: LeadDetail }) {
  const na = lead.next_action ? NEXT_ACTIONS[lead.next_action as NextAction] : null;

  if (lead.status === "new" || !lead.analysis) {
    return (
      <Card className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <div className="text-[20px] font-semibold tracking-tight">Firma je uložená.</div>
          <p className="mt-1 text-[15px] text-white/50">
            Analýza overí web, nájde pochvalu a jednu konkrétnu vec a pripraví call brief.
          </p>
        </div>
        <AnalyzeButton leadId={lead.id} label="Analyzovať firmu" size="lg" />
      </Card>
    );
  }

  if (HANDOFF_STATUSES.includes(lead.status) || (lead.status === "lost" && (lead.consent || lead.qualification))) {
    return <HandoffCard lead={lead} />;
  }

  if (lead.status === "analyzed") {
    return (
      <Card className="p-6 sm:p-7">
        <div className="text-[12px] font-semibold tracking-[0.16em] text-yellow-200 uppercase">
          {na?.icon ?? "👀"} {na?.label ?? "Skontrolovať lead"}
        </div>
        <p className="mt-2 text-[15px] text-white/60">
          {lead.analysis?.nothing_found
            ? "Nenašli sme výrazný dôvod volať. Ak vidíš niečo, čo analýza nenašla, doplň to do poznámky a pošli lead volajúcemu — inak ho vyraď."
            : "Niektoré údaje nie sú dostatočne overené. Skontroluj ich a potom lead pošli volajúcemu."}
        </p>
        <ul className="mt-3 space-y-1 text-[14px] text-white/50">
          {lead.priority_reasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <StageButtons leadId={lead.id} status={lead.status} />
          <AnalyzeButton leadId={lead.id} label="Znova analyzovať" variant="ghost" />
        </div>
      </Card>
    );
  }

  if (lead.status === "ready_to_call" || lead.status === "called") {
    return (
      <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <div className="text-[12px] font-semibold tracking-[0.16em] text-blue-200 uppercase">☎️ U volajúceho</div>
          <p className="mt-2 text-[15px] text-white/60">
            {lead.status === "called"
              ? `Volané ${lead.call_attempts}× — čaká sa na ďalší pokus.`
              : "Lead je pripravený na telefonát."}
          </p>
          <div className="mt-3">
            <AssignSelect leadId={lead.id} value={lead.assigned_to} callers={callers()} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/leady/leads/${lead.id}/call`} variant="secondary">
            Volám sám
          </ButtonLink>
          <AnalyzeButton leadId={lead.id} label="Znova analyzovať" variant="ghost" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div>
        <div className="text-[12px] font-semibold tracking-[0.16em] text-white/50 uppercase">
          {na ? `${na.icon} ${na.label}` : "Bez ďalšieho kroku"}
        </div>
        {lead.next_action_at ? (
          <p className="mt-2 text-[15px] text-white/60">Termín: {fmtDate(lead.next_action_at)}</p>
        ) : null}
      </div>
      <StageButtons leadId={lead.id} status={lead.status} />
    </Card>
  );
}

const HANDOFF_STATUSES: LeadStatus[] = ["dominik_call", "contacted", "interested", "demo", "offer_sent", "negotiation", "won", "paid"];

/**
 * Dominikov handoff: kto volal, čo presne zaznelo (súhlas ≠ záujem), prečo bol lead vybraný,
 * stav webu a istota, odporúčaný pravdivý úvod a kroky pipeline.
 */
async function HandoffCard({ lead }: { lead: LeadDetail }) {
  const c = lead.consent;
  const q = lead.qualification;
  const settings = await (await db()).getSettings();
  const callerSpeech = allUsers().find((u) => u.username === c?.by_user)?.speech;
  const opening = c ? dominikOpening2({ adminName: adminName(), lead, callerSpeech }) : (q?.dominik_opening ?? []);
  const ws = lead.website_status;
  const src = leadSource(lead);
  return (
    <Card className="relative overflow-hidden p-6 ring-ok/20 sm:p-8">
      <div className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-ok/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold tracking-[0.16em] text-green-300 uppercase">
            🟢 {c?.kind === "info" ? "Chce informácie" : "Súhlas s kontaktom"}
          </span>
          <StatusPill status={lead.status} />
        </div>
        <p className="mt-3 text-[16px] text-white/80">
          {c ? `${c.by_name} · ${fmtDateTime(c.at)}` : q ? `${q.caller} · ${fmtDateTime(q.called_at)}` : "—"}
          {" — "}
          <span className="text-white/55">súhlas s kontaktom nie je záujem o web; ten zisťuješ ty.</span>
        </p>

        <dl className="mt-5 grid gap-x-8 gap-y-2.5 text-[14px] sm:grid-cols-2">
          <HRow label="Kontaktná osoba" value={c?.contact_person ?? lead.company.contact_person} />
          <HRow label="Telefón" value={lead.company.phone} />
          <HRow label="Mesto / segment" value={`${lead.company.city ?? "—"} · ${categoryOf(lead.company.category).label}`} />
          <HRow label="Pôvodný zdroj" value={src} />
          <HRow
            label="Stav webu"
            value={ws ? `${WEBSITE_STATUS_LABEL[ws]}${lead.website_issue ? ` — ${ISSUE_LABEL[lead.website_issue] ?? lead.website_issue}` : ""}` : "neurčený (starší lead)"}
          />
          <HRow label="Istota / skóre" value={lead.score ? `${lead.score.points} b. (${lead.score.band})` : (lead.analysis?.confidence ?? "—")} />
          <HRow label="Čo klient povedal" value={c?.company_said ?? q?.company_said ?? null} />
          <HRow label="Čo ho zaujalo" value={c?.caught_attention ?? null} />
          <HRow label="Počul cenu" value={c ? (c.heard_price ? `áno${settings.package.price ? ` (${settings.package.price} €)` : ""}` : "nie") : "—"} />
          <HRow label="Kedy volať" value={c ? [c.call_on ? fmtDate(c.call_on) : null, c.call_note].filter(Boolean).join(" · ") || "kedykoľvek" : "—"} />
          <HRow label="E-mail" value={c?.email ?? q?.email ?? null} />
          <HRow label="Poznámka" value={c?.note ?? null} />
        </dl>
        {lead.analysis?.why_this_lead ? (
          <p className="mt-4 text-[14px] text-white/55">
            <span className="text-white/35">Prečo vybraný: </span>
            {lead.analysis.why_this_lead}
          </p>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <Eyebrow>Pravdivý úvod</Eyebrow>
            <ol className="mt-3 space-y-2.5">
              {opening.map((line, i) => (
                <li key={i} className="flex gap-3 text-[16px] leading-relaxed text-white/90">
                  <span className="mt-1 font-mono text-[12px] text-white/25">{i + 1}</span>
                  <span>„{line}“</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[13px] text-white/40">
              Nehovor „počul som, že máte záujem“ — firma iba dovolila, aby si sa ozval.
            </p>
            {lead.sale ? (
              <p className="mt-4 text-[14px] text-white/70">
                Predaj: {lead.sale.price ?? "—"} €{lead.sale.paid_at ? ` · zaplatené ${fmtDate(lead.sale.paid_at)}` : ""}
              </p>
            ) : null}
          </div>
          {lead.status === "paid" ? (
            <div className="rounded-3xl bg-ok/10 p-5 text-[15px] text-green-100 ring-1 ring-ok/25">✅ Zaplatené. Hotovo.</div>
          ) : lead.status === "lost" ? (
            <div className="rounded-3xl bg-white/[0.03] p-5 text-[14px] text-white/55 ring-1 ring-line">
              Stratené{lead.lost_reason ? ` (${lead.lost_reason})` : ""}.
            </div>
          ) : (
            <SalesPanel leadId={lead.id} status={lead.status} phone={lead.company.phone} defaultPrice={settings.package.price} />
          )}
        </div>
      </div>
    </Card>
  );
}

function HRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 pb-1.5">
      <dt className="shrink-0 text-white/40">{label}</dt>
      <dd className="text-right text-white/85">{value || "—"}</dd>
    </div>
  );
}

function ScoreBox({ lead }: { lead: LeadDetail }) {
  const s = lead.score;
  if (!s) return null;
  return (
    <Section icon="📊" title={`Skóre ${s.points} (${{ high: "vysoko", medium: "stredne", low: "nízko" }[s.band]})`}>
      <p className="mb-2 text-[12px] text-white/35">Pravidlá v{s.version} — každý bod má dôvod.</p>
      <ul className="space-y-1 text-[13px]">
        {s.factors.map((f) => (
          <li key={f.key}>
            <span className="text-green-300">+{f.points}</span> {f.label}
          </li>
        ))}
        {s.risks.map((f) => (
          <li key={f.key}>
            <span className="text-yellow-200">{f.points}</span> {f.label}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function EngineBadge({ lead }: { lead: LeadDetail }) {
  const a = lead.analysis;
  if (!a) return null;
  const conf = { high: "vysoká", medium: "stredná", low: "nízka" }[a.confidence];
  return (
    <span className="text-[11px] text-white/35">
      {{ claude: "AI", rules: "Pravidlá", routine: "Ranná rutina" }[a.engine]} · istota {conf}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[12px] text-white/35">{label}</dt>
      <dd className="mt-1 leading-relaxed text-white/75">{value ?? "neoverené"}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/35">{label}</dt>
      <dd className="truncate text-right text-white/80">{value || "—"}</dd>
    </div>
  );
}

function OfferFootnote({ has, category }: { has: boolean; category: string }) {
  if (has) return null;
  return (
    <p className="mt-8 text-center text-[12px] text-white/25">
      Pre segment {categoryOf(category).label.toLowerCase()} nemáme dostupný rozpracovaný web — ponuka sa preto v
      call briefe nezobrazuje.{" "}
      <Link href="/leady/settings" className="underline underline-offset-2 hover:text-white/60">
        Ponuky
      </Link>
    </p>
  );
}
