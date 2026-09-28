import { categoryOf, DATA_QUALITY_LABEL, FEEDBACK_LABEL, WEBSITE_RESOLUTION_LABEL, type LeadDetail } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { Section, cn } from "./ui";
import { ResolveFeedbackButton } from "./resolve-feedback";

type Web = { url?: string; domain?: string; verdict?: string; evidence?: string[]; negative?: string[]; sources?: string[]; redirect_chain?: string[] };
const VERDICT_TONE: Record<string, string> = {
  confirmed: "text-green-300",
  probable: "text-sky-200",
  uncertain: "text-yellow-200",
  unreachable: "text-yellow-200",
  reported: "text-yellow-200",
  historical: "text-white/40",
  rejected: "text-red-300",
};

/** Admin: PREČO systém tvrdí, čo tvrdí. Pôvod a čerstvosť každého údaja + TRACE LEAD. */
export function RadarPanel({ lead }: { lead: LeadDetail }) {
  const p = lead.company.profile;
  if (!p) return null;
  const webs = (p.websites ?? []) as Web[];
  const rejected = (p.rejected_websites ?? []) as { domain?: string; why?: string }[];
  const historical = (p.historical_websites ?? []) as { domain?: string; why?: string }[];
  return (
    <Section
      icon="🛰️"
      title="Lead Radar"
      aside={
        <span className="text-[12px] text-white/45">
          {p.country} · dáta {DATA_QUALITY_LABEL[p.data_quality ?? "research"]} · identita {p.identity?.confidence ?? "?"}
        </span>
      }
    >
      <div className="space-y-4 text-[14px]">
        {(lead.feedback ?? []).length ? (
          <Block title="Spätná väzba volajúcich">
            <ul className="space-y-1.5">
              {(lead.feedback ?? []).map((f) => (
                <li key={f.id} className={cn("flex flex-wrap items-center justify-between gap-2", f.resolved_at && "text-white/40 line-through")}>
                  <span>
                    {FEEDBACK_LABEL[f.kind]} · {f.by} · {fmtDateTime(f.at)}
                    {f.url ? ` · ${f.url}` : ""}
                    {f.note ? ` — „${f.note}“` : ""}
                  </span>
                  {!f.resolved_at ? <ResolveFeedbackButton leadId={lead.id} feedbackId={f.id} /> : null}
                </li>
              ))}
            </ul>
          </Block>
        ) : null}

        <Block title="Identita — prečo tieto zdroje patria jednej firme">
          <ul className="space-y-0.5 text-white/70">
            {(p.identity?.evidence ?? []).map((e) => (
              <li key={e}>✓ {e}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] text-white/40">
            {p.legal_name ? `Právny názov: ${p.legal_name} · ` : ""}
            {p.brand_names?.length ? `Značky: ${p.brand_names.join(", ")}` : ""}
            {p.historical_names?.length ? ` · Staršie názvy: ${p.historical_names.join(", ")}` : ""}
          </p>
          {(p.possible_duplicates ?? []).length ? (
            <p className="mt-1 text-[12px] text-yellow-200">
              Možná duplicita: {(p.possible_duplicates as { name?: string; why?: string }[]).map((d) => `${d.name} (${d.why})`).join("; ")}
            </p>
          ) : null}
        </Block>

        <Block title="Kontakty — pôvod a istota">
          <Facts label="Telefón" list={p.phones} primary={p.primary_phone?.value} />
          <Facts label="E-mail" list={p.emails} />
          <Facts label="IČO" list={p.company_ids} />
          <Facts label="Adresa" list={p.addresses} />
        </Block>

        <Block title={`Web — ${WEBSITE_RESOLUTION_LABEL[p.website?.status ?? "uncertain"]}`}>
          {webs.length ? (
            <ul className="space-y-1.5">
              {webs.map((w, i) => (
                <li key={i}>
                  <span className={cn("font-medium", VERDICT_TONE[w.verdict ?? ""] ?? "")}>
                    {w.domain} · {w.verdict}
                  </span>
                  <span className="text-white/45"> ({(w.sources ?? []).join(", ")})</span>
                  <div className="text-[12px] text-white/55">
                    {(w.evidence ?? []).join(" · ")}
                    {(w.negative ?? []).length ? <span className="text-red-300/80"> · ✗ {(w.negative ?? []).join(" · ")}</span> : null}
                    {(w.redirect_chain ?? []).length > 1 ? <span className="text-white/40"> · presmerovanie: {(w.redirect_chain ?? []).join(" → ")}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-white/50">Žiadny kandidát na web.</p>
          )}
          {rejected.length ? (
            <p className="mt-1.5 text-[12px] text-red-300/80">Odmietnuté (už sa nepriradia): {rejected.map((r) => `${r.domain} — ${r.why}`).join("; ")}</p>
          ) : null}
          {historical.length ? <p className="mt-1 text-[12px] text-white/40">Historické: {historical.map((r) => `${r.domain} (${r.why})`).join("; ")}</p> : null}
          {p.web_search_queries?.length ? <p className="mt-1 text-[12px] text-white/40">Hľadané: {p.web_search_queries.join(" · ")}</p> : null}
          {p.website?.health?.issues?.length ? (
            <ul className="mt-1.5 space-y-0.5 text-[12px] text-white/60">
              {p.website.health.issues.map((i) => (
                <li key={i.key}>
                  • {i.text} {i.excerpt ? <span className="text-white/35">— {i.excerpt}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Block>

        {p.socials?.length ? (
          <Block title="Social">
            <ul className="space-y-1">
              {p.socials.map((s, i) => (
                <li key={i}>
                  <a href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" className={cn("underline-offset-2 hover:underline", VERDICT_TONE[s.match ?? ""] ?? "")}>
                    {s.platform} {s.handle ?? ""} · {s.match}
                  </a>
                  <span className="text-[12px] text-white/45"> {(s.evidence ?? []).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </Block>
        ) : null}

        <Block title="Kategória a popis">
          <p>
            {categoryOf(p.category?.id).label} ({p.category?.confidence ?? "?"}){p.category?.subcategory ? ` · ${p.category.subcategory}` : ""}
          </p>
          <p className="text-[12px] text-white/45">{(p.category?.evidence ?? []).join(" · ")}</p>
          <p className="mt-1.5">{p.description?.text}</p>
          <p className="text-[12px] text-white/45">
            istota {p.description?.confidence ?? "?"} · zdroje {(p.description?.sources ?? []).join(", ") || "—"}
          </p>
          {p.business_status ? (
            <p className="mt-1.5 text-[12px] text-white/55">
              Aktivita: {p.business_status.value} — {p.business_status.evidence.join(", ") || "bez signálov"}
            </p>
          ) : null}
        </Block>

        <Block title="Obchodný dôvod · routing">
          <ul className="space-y-0.5">
            {(p.commercial_problems ?? []).map((x) => (
              <li key={x.code}>
                <b className="font-medium">{x.code}</b> {x.heuristic ? <span className="text-yellow-200">(heuristika)</span> : null} — {x.evidence.join(" · ")}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] text-white/55">
            Volajúci: {lead.assigned_to ?? "—"} · {(lead.caller_fit?.reasons ?? p.caller_fit?.reasons ?? []).join(" · ")}
          </p>
          {p.data_quality_why?.length ? <p className="text-[12px] text-yellow-200/80">Neisté: {p.data_quality_why.join(" · ")}</p> : null}
        </Block>

        <Block title="Čerstvosť">
          <p className="text-[12px] text-white/55">
            {Object.entries(p.last_verified ?? {})
              .map(([k, v]) => `${k}: ${fmtDateTime(v)}`)
              .join(" · ") || "—"}
          </p>
        </Block>

        <details className="group rounded-xl bg-white/[0.02] ring-1 ring-inset ring-line">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[13px] text-white/55">TRACE LEAD ({(p.trace ?? []).length} krokov)</summary>
          <ol className="space-y-1 px-3 pb-3 font-mono text-[11.5px] text-white/60">
            {(p.trace ?? []).map((t, i) => (
              <li key={i}>
                <span className="text-white/35">{t.step}</span> {t.detail}
              </li>
            ))}
          </ol>
        </details>
      </div>
    </Section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-white/40 uppercase">{title}</div>
      {children}
    </div>
  );
}

function Facts({ label, list, primary }: { label: string; list?: { value: string; confidence: string; sources: string[]; verified_at?: string | null }[]; primary?: string }) {
  if (!list?.length) return null;
  return (
    <div className="flex gap-2 text-[13px]">
      <span className="w-16 shrink-0 text-white/40">{label}</span>
      <span className="space-y-0.5">
        {list.map((f) => (
          <span key={f.value} className="block">
            {f.value === primary ? <b>{f.value}</b> : f.value} <span className="text-white/40">· {f.confidence} · {f.sources.join(", ")}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
