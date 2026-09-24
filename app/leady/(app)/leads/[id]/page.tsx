import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Mail, Phone } from "lucide-react";
import { requireUser, callers } from "@/lead-engine/lib/auth";
import { getLead } from "@/lead-engine/lib/leads";
import { displayUrl, fmtDate, fmtDateTime, telHref } from "@/lead-engine/lib/format";
import {
  ARCHIVE_LABEL,
  DOMINIK_OUTCOME_LABEL,
  NEXT_ACTIONS,
  OUTCOME_LABEL,
  categoryOf,
  type CallOutcome,
  type DominikOutcome,
  type LeadDetail,
  type NextAction,
} from "@/lead-engine/lib/types";
import { ButtonLink, Card, CategoryLabel, Eyebrow, PriorityTag, Section, StatusPill, TrustRow } from "@/lead-engine/components/ui";
import { FadeIn } from "@/lead-engine/components/motion";
import { CallBrief } from "@/lead-engine/components/call-brief";
import { ClaimList } from "@/lead-engine/components/evidence";
import { Timeline } from "@/lead-engine/components/timeline";
import {
  AnalyzeButton,
  ArchiveControl,
  AssignSelect,
  CompanyEditor,
  DominikCallPanel,
  NotesEditor,
  StageButtons,
} from "@/lead-engine/components/lead-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const lead = await getLead(user, (await params).id);
  if (!lead) {
    if (user.role === "caller") redirect("/leady");
    notFound();
  }

  if (user.role === "caller") {
    return (
      <div>
        <Link href="/leady" className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white">
          <ArrowLeft className="size-4" /> Dnes
        </Link>
        <CallBrief lead={lead} mode="caller" />
      </div>
    );
  }

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
              <Row label="Web" value={c.website ? displayUrl(c.website) : "nemá"} />
              <Row label="Zdroj" value={{ manual: "Manuálne", import: "Import", api: "API", routine: "Ranná rutina" }[lead.source]} />
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

  if (lead.status === "dominik_call" && lead.qualification) {
    const q = lead.qualification;
    return (
      <Card className="relative overflow-hidden p-6 ring-ok/20 sm:p-8">
        <div className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-ok/10 blur-3xl" />
        <div className="relative">
          <div className="text-[12px] font-semibold tracking-[0.16em] text-green-300 uppercase">🟢 Kvalifikovaný lead</div>
          <p className="mt-3 text-[17px] text-white/85">
            {q.caller} volal {fmtDateTime(q.called_at)}. Firma súhlasila, aby si zavolal.
          </p>
          {q.company_said ? (
            <blockquote className="mt-4 border-l-2 border-ok/40 pl-4 text-[17px] leading-relaxed text-white">
              „{q.company_said}“
            </blockquote>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-white/45">
            {q.preferred_time ? (
              <span>
                Kedy volať:{" "}
                <span className="text-white/80">
                  {{ today: "dnes", tomorrow: "zajtra", later: "neskôr" }[q.preferred_time]}
                </span>
              </span>
            ) : null}
            {q.email ? (
              <span>
                E-mail: <span className="text-white/80">{q.email}</span>
              </span>
            ) : null}
            {na ? (
              <span>
                Ďalší krok:{" "}
                <span className="text-white/80">
                  {na.icon} {na.label}
                </span>
              </span>
            ) : null}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <Eyebrow>Čo ti odporúčame povedať</Eyebrow>
              <ol className="mt-3 space-y-2.5">
                {q.dominik_opening.map((s, i) => (
                  <li key={i} className="flex gap-3 text-[16px] leading-relaxed text-white/90">
                    <span className="mt-1 text-[12px] font-mono text-white/25">{i + 1}</span>
                    <span>„{s}“</span>
                  </li>
                ))}
              </ol>
              <div className="mt-6">
                <Eyebrow>Cieľ hovoru</Eyebrow>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-white/70">
                  {q.dominik_goal.map((g, i) => (
                    <span key={g} className="flex items-center gap-2">
                      {i > 0 ? <span className="text-white/25">→</span> : null}
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <DominikCallPanel leadId={lead.id} phone={lead.company.phone} />
          </div>
        </div>
      </Card>
    );
  }

  if (lead.status === "analyzed") {
    return (
      <Card className="p-6 sm:p-7">
        <div className="text-[12px] font-semibold tracking-[0.16em] text-yellow-200 uppercase">
          {na?.icon ?? "👀"} {na?.label ?? "Skontrolovať lead"}
        </div>
        <p className="mt-2 text-[15px] text-white/60">
          {lead.analysis?.nothing_found
            ? "Nenašli sme výrazný dôvod volať. Ak vidíš niečo, čo analýza nenašla, doplň to do poznámky a pošli lead kamarátovi — inak ho vyraď."
            : "Niektoré údaje nie sú dostatočne overené. Skontroluj ich a potom lead pošli kamarátovi."}
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
          <div className="text-[12px] font-semibold tracking-[0.16em] text-blue-200 uppercase">☎️ U kamaráta na volaní</div>
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

function EngineBadge({ lead }: { lead: LeadDetail }) {
  const a = lead.analysis;
  if (!a) return null;
  const conf = { high: "vysoká", medium: "stredná", low: "nízka" }[a.confidence];
  return (
    <span className="text-[11px] text-white/35">
      {a.engine === "claude" ? "AI" : "Pravidlá"} · istota {conf}
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
