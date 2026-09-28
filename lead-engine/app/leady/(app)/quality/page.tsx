import Link from "next/link";
import { requireUser, allUsers } from "@/lib/auth";
import { listLeads } from "@/lib/leads";
import { db } from "@/lib/db";
import { dataQuality, routingMatrix, sourceFunnel } from "@/lib/quality";
import { categoryOf, DATA_QUALITY_LABEL, FEEDBACK_LABEL, WEBSITE_RESOLUTION_LABEL, type FeedbackKind } from "@/lib/types";
import { Card, Eyebrow, Section, cn } from "@/components/ui";
import { FadeIn } from "@/components/motion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kvalita dát" };

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);
const HEALTH_TONE: Record<string, string> = { ok: "text-green-300", degraded: "text-yellow-200", unavailable: "text-red-300", not_configured: "text-white/40" };
const HEALTH_LABEL: Record<string, string> = { ok: "OK", degraded: "DEGRADED", unavailable: "NEDOSTUPNÉ", not_configured: "nenastavené" };
const PROVIDER_LABEL: Record<string, string> = {
  azet: "azet.sk katalóg (SK)",
  zlatestranky_sk: "Zlaté stránky SK",
  zlatestranky_cz: "Zlaté stránky CZ",
  search: "Vyhľadávanie (WebSearch rutiny)",
  agent: "WebSearch rutiny",
  brave: "Brave Search API",
  google_cse: "Google Programmable Search",
  places: "Google Places API",
  instagram_direct: "Instagram priamo",
  facebook_direct: "Facebook priamo",
};

export default async function QualityPage() {
  const user = await requireUser("admin");
  const users = allUsers();
  const repo = await db();
  const [leads, calls, settings] = await Promise.all([listLeads(user), repo.listAllCalls(), repo.getSettings()]);
  const q = dataQuality(leads, calls);
  const runs = (settings.radar?.runs ?? []) as Record<string, unknown>[];
  const last = runs.at(-1) as
    | {
        day?: string;
        provider_health?: Record<string, string>;
        stats?: { seeds?: number; entities?: number; stopped?: Record<string, number>; tiers?: Record<string, number>; resolution?: Record<string, number> };
        selected?: Record<string, number>;
        need?: Record<string, number>;
        yield?: { strategy: string; category: string; country: string; queries: number; results: number; new_businesses: number; verified: number }[];
        net?: Record<string, number>;
      }
    | undefined;
  const reverify = leads.filter((l) => l.needs_reverify || (l.feedback ?? []).some((f) => !f.resolved_at));

  return (
    <div>
      <FadeIn>
        <h1 className="text-[32px] font-semibold tracking-[-0.035em]">Kvalita dát</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-white/45">
          Zlepšuje sa Lead Radar naozaj? Všetko na unikátnych firmách (jedna firma nájdená v katalógu, na Instagrame aj Facebooku = 1 lead).
        </p>
      </FadeIn>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Caller trust rate" value={pct(q.callerTrust.value)} hint={`${q.callerTrust.num} / ${q.callerTrust.den} volaných leadov bez opravy dát`} strong />
        <Kpi label="Leady z radaru" value={String(q.radarLeads)} hint={`${q.rejectedBeforeQueue} vyradených pred frontou · ${q.review} na kontrolu`} />
        <Kpi label="Popis neoverený" value={String(q.descriptionUnknown)} hint={`kategória s nízkou istotou: ${q.categoryLow}`} />
        <Kpi label="Riziko duplicity" value={pct(q.duplicateRate)} hint={`${q.duplicateRisk} možných + ${q.feedback.duplicate ?? 0} nahlásených`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <FadeIn delay={0.04}>
          <Section icon="🌐" title="Stav webu">
            <List rows={Object.entries(q.resolution).map(([k, n]) => [WEBSITE_RESOLUTION_LABEL[k as keyof typeof WEBSITE_RESOLUTION_LABEL] ?? k, n])} />
          </Section>
        </FadeIn>
        <FadeIn delay={0.05}>
          <Section icon="🏅" title="Kvalita dát (nie hodnotenie firmy)">
            <List rows={Object.entries(q.tiers).map(([k, n]) => [DATA_QUALITY_LABEL[k as keyof typeof DATA_QUALITY_LABEL] ?? k, n])} />
            <p className="mt-3 text-[12px] text-white/35">GOLD = všetko overené · SILVER = jedna vec neistá · RESEARCH = do fronty nejde</p>
          </Section>
        </FadeIn>
        <FadeIn delay={0.06}>
          <Section icon="📣" title="Spätná väzba volajúcich">
            {Object.keys(q.feedback).length ? (
              <List rows={Object.entries(q.feedback).map(([k, n]) => [FEEDBACK_LABEL[k as FeedbackKind] ?? k, n])} />
            ) : (
              <p className="text-[14px] text-white/45">Zatiaľ žiadna — dobré znamenie (alebo sa ešte nevolalo).</p>
            )}
          </Section>
        </FadeIn>
      </div>

      <FadeIn delay={0.08} className="mt-5">
        <Section icon="🩺" title={`Zdroje — posledný beh${last?.day ? ` (${last.day})` : ""}`}>
          {last?.provider_health ? (
            <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
              {Object.entries(last.provider_health).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-line/60 py-1 text-[14px]">
                  <span className="text-white/70">{PROVIDER_LABEL[k] ?? k}</span>
                  <span className={cn("font-medium", HEALTH_TONE[v] ?? "text-white/60")}>{HEALTH_LABEL[v] ?? v}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-white/45">Lead Radar ešte nebežal.</p>
          )}
          {last?.stats ? (
            <p className="mt-3 text-[13px] text-white/50">
              {last.stats.seeds} záznamov → {last.stats.entities} firiem · vyradené skoro:{" "}
              {Object.entries(last.stats.stopped ?? {})
                .map(([k, n]) => `${k} ${n}`)
                .join(", ") || "—"}
              {" · "}vybrané {Object.entries(last.selected ?? {}).map(([k, n]) => `${k} ${n}/${last.need?.[k] ?? "?"}`).join(", ")}
            </p>
          ) : null}
          <p className="mt-2 text-[12px] text-white/35">
            Instagram a Facebook priamo nesťahujeme (login wall, 429, podmienky zakazujú automatický zber) — profily hľadáme cez vyhľadávanie.
          </p>
        </Section>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-5">
        <Card className="overflow-x-auto p-5">
          <Eyebrow className="mb-3">Source quality — zdroj → výsledok</Eyebrow>
          <Table
            head={["Zdroj", "Leady", "Volané", "Rozhovor", "Súhlas", "Záujem", "Demo", "Predaj"]}
            rows={sourceFunnel(leads, calls, users).map((r) => [r.source, r.leads, r.called, r.conversation, r.consent, r.interest, r.demo, r.won])}
          />
        </Card>
      </FadeIn>

      <FadeIn delay={0.12} className="mt-5">
        <Card className="overflow-x-auto p-5">
          <Eyebrow className="mb-1">Routing — volajúci × segment × krajina</Eyebrow>
          <p className="mb-3 text-[12px] text-white/40">
            Podklad pre routing segmentov, nie rebríček ľudí. Routing sa sám nemení — pri malej vzorke (menej ako 20 rozhovorov) je to iba orientačné.
          </p>
          <Table
            head={["Volajúci", "Segment", "Krajina", "Hovory", "Volané leady", "Rozhovor", "Súhlas", "Záujem", "Demo", "Predaj"]}
            rows={routingMatrix(leads, calls, users).map((r) => [r.caller, categoryOf(r.category).label, r.country, r.calls, r.called, r.conversation, r.consent, r.interest, r.demo, r.won])}
          />
        </Card>
      </FadeIn>

      {last?.yield?.length ? (
        <FadeIn delay={0.14} className="mt-5">
          <Card className="overflow-x-auto p-5">
            <Eyebrow className="mb-3">Yield discovery stratégií (posledný beh)</Eyebrow>
            <Table
              head={["Stratégia", "Segment", "Krajina", "Dopyty", "Výsledky", "Nové firmy", "Overené leady"]}
              rows={last.yield.map((y) => [y.strategy, categoryOf(y.category).label, y.country, y.queries, y.results, y.new_businesses, y.verified])}
            />
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn delay={0.16} className="mt-5">
        <Section icon="🔎" title={`Na preverenie (${reverify.length})`}>
          {reverify.length ? (
            <ul className="space-y-2 text-[14px]">
              {reverify.slice(0, 40).map((l) => (
                <li key={l.id} className="flex flex-wrap justify-between gap-2 border-b border-line/60 pb-2">
                  <Link href={`/leady/leads/${l.id}`} className="font-medium underline-offset-2 hover:underline">
                    {l.company.name}
                  </Link>
                  <span className="text-white/50">
                    {(l.feedback ?? [])
                      .filter((f) => !f.resolved_at)
                      .map((f) => `${FEEDBACK_LABEL[f.kind]} (${f.by})`)
                      .join(" · ") || "čaká na recheck"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-white/45">Nič nečaká.</p>
          )}
        </Section>
      </FadeIn>
    </div>
  );
}

function Kpi({ label, value, hint, strong }: { label: string; value: string; hint: string; strong?: boolean }) {
  return (
    <Card className={cn("p-5", strong && "ring-1 ring-ok/30")}>
      <div className="text-[12px] tracking-wide text-white/45 uppercase">{label}</div>
      <div className="mt-1 text-[30px] font-semibold tracking-[-0.03em] tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-white/40">{hint}</div>
    </Card>
  );
}

function List({ rows }: { rows: [string, number][] }) {
  if (!rows.length) return <p className="text-[14px] text-white/45">Zatiaľ žiadne dáta.</p>;
  return (
    <ul className="space-y-1.5 text-[14px]">
      {rows.map(([k, n]) => (
        <li key={k} className="flex justify-between">
          <span className="text-white/70">{k}</span>
          <span className="tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full min-w-[640px] text-[13px]">
      <thead className="text-white/40">
        <tr>
          {head.map((h, i) => (
            <th key={h} className={cn("py-1.5 font-normal", i ? "text-right" : "text-left")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((r, i) => (
            <tr key={i} className="border-t border-line/60">
              {r.map((c, j) => (
                <td key={j} className={cn("py-1.5", j ? "text-right tabular-nums" : "")}>
                  {c}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td className="py-2 text-white/40" colSpan={head.length}>
              Zatiaľ žiadne dáta.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
