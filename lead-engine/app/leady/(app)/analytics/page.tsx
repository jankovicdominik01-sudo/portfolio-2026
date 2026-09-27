import Link from "next/link";
import { requireUser, allUsers } from "@/lib/auth";
import { listLeads } from "@/lib/leads";
import { db } from "@/lib/db";
import { breakdown, countLeads, factorLift, leadSource, rates, websiteProblem, MIN_SAMPLE, type Counts } from "@/lib/analytics";
import { categoryOf } from "@/lib/types";
import { ISSUE_LABEL, WEIGHTS } from "@/lib/score";
import { Card, Eyebrow, Section, cn } from "@/components/ui";
import { FadeIn } from "@/components/motion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytika" };

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ caller?: string }> }) {
  const user = await requireUser("admin");
  const users = allUsers();
  const callersAll = users.filter((u) => u.role === "caller");
  const sel = (await searchParams).caller;
  const caller = callersAll.some((c) => c.username === sel) ? sel! : null;
  const [leads, calls] = await Promise.all([listLeads(user), (await db()).listAllCalls()]);
  const k = countLeads(leads, calls, users, caller);

  const callerFunnel: [string, number][] = [
    ["Pridelené", k.assigned],
    ["Skúšané", k.attempted],
    ["Rozhovor", k.conversation],
    ["Súhlas s kontaktom", k.consent],
  ];
  const domFunnel: [string, number][] = [
    ["Súhlas", k.consent],
    ["Dovolaný", k.dom_contacted],
    ["Skutočný záujem", k.interest],
    ["Ponuka", k.offer],
    ["Predaj", k.sale],
    ["Zaplatené", k.paid],
  ];

  return (
    <div>
      <FadeIn>
        <h1 className="text-[32px] font-semibold tracking-[-0.035em]">Analytika</h1>
        <p className="mt-1 text-[15px] text-white/45">
          Všetko na unikátnych leadoch (nie počte hovorov). Z {k.assigned} pridelených leadov je zatiaľ {k.paid} zaplatených
          · tržby {k.revenue} €.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Tab href="/leady/analytics" on={!caller}>
            Všetci
          </Tab>
          {callersAll.map((c) => (
            <Tab key={c.username} href={`/leady/analytics?caller=${c.username}`} on={caller === c.username}>
              {c.name}
              {c.active ? "" : " (história)"}
            </Tab>
          ))}
        </div>
      </FadeIn>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <FadeIn delay={0.04}>
          <Section icon="☎️" title="Funnel volajúceho">
            <Funnel steps={callerFunnel} />
            <p className="mt-3 text-[12px] text-white/35">Hovorov spolu: {k.calls} (na {k.attempted} leadoch)</p>
          </Section>
        </FadeIn>
        <FadeIn delay={0.06}>
          <Section icon="💼" title="Dominikov funnel">
            <Funnel steps={domFunnel} />
          </Section>
        </FadeIn>
      </div>

      <FadeIn delay={0.08} className="mt-5">
        <Section icon="📐" title="Kľúčové metriky">
          <table className="w-full text-[14px]">
            <tbody>
              {rates(k).map((r) => (
                <tr key={r.key} className="border-b border-line/60">
                  <td className="py-2 pr-4 text-white/70">{r.label}</td>
                  <td className="py-2 text-right text-white/45 tabular-nums">
                    {r.num} / {r.den}
                  </td>
                  <td className="w-20 py-2 text-right font-medium tabular-nums">{pct(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-5 space-y-5">
        <Breakdown title="Podľa zdroja" rows={breakdown(leads, calls, users, leadSource)} />
        <Breakdown
          title="Podľa problému webu"
          rows={breakdown(leads, calls, users, websiteProblem)}
          label={(k) => ISSUE_LABEL[k] ?? { no_website: "bez webu", broken: "nefunkčný", weak: "slabý", uncertain: "neisté", working: "funkčný", unknown: "neurčené (staršie)" }[k] ?? k}
        />
        <Breakdown title="Podľa segmentu" rows={breakdown(leads, calls, users, (l) => l.company.category)} label={(k) => categoryOf(k).label} />
        <Breakdown title="Podľa pásma skóre" rows={breakdown(leads, calls, users, (l) => l.score?.band ?? "bez skóre")} />
      </FadeIn>

      <FadeIn delay={0.12} className="mt-5">
        <Section icon="🔁" title="Learning loop — faktory skóre vs. výsledky">
          <p className="mb-3 text-[13px] text-white/45">
            Súhlas = súhlasy / rozhovory. Porovnanie leadov S faktorom a BEZ neho. Kým nemá faktor aspoň {MIN_SAMPLE} rozhovorov,
            je to iba orientačné — váhy zatiaľ nemeníme.
          </p>
          <table className="w-full text-[13px]">
            <thead className="text-white/40">
              <tr>
                <th className="py-1.5 text-left font-normal">Faktor (váha)</th>
                <th className="text-right font-normal">Rozhovory s / bez</th>
                <th className="text-right font-normal">Súhlas s</th>
                <th className="text-right font-normal">Súhlas bez</th>
                <th className="text-right font-normal">Zaplatené s</th>
              </tr>
            </thead>
            <tbody>
              {factorLift(leads, calls, users).map((f) => (
                <tr key={f.key} className={cn("border-t border-line/60", !f.enough && "text-white/45")}>
                  <td className="py-1.5">
                    {f.key} ({WEIGHTS[f.key as keyof typeof WEIGHTS] ?? "?"})
                  </td>
                  <td className="text-right tabular-nums">
                    {f.with.conversation} / {f.without.conversation}
                  </td>
                  <td className="text-right tabular-nums">{pct(f.consentWith)}</td>
                  <td className="text-right tabular-nums">{pct(f.consentWithout)}</td>
                  <td className="text-right tabular-nums">{f.with.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </FadeIn>
    </div>
  );
}

function Tab({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn("rounded-full px-3.5 py-1.5 text-[13px] ring-1 ring-inset", on ? "bg-white text-black ring-white" : "text-white/65 ring-line")}
    >
      {children}
    </Link>
  );
}

function Funnel({ steps }: { steps: [string, number][] }) {
  const max = Math.max(1, ...steps.map(([, n]) => n));
  return (
    <ul className="space-y-2">
      {steps.map(([label, n], i) => (
        <li key={label} className="flex items-center gap-3 text-[14px]">
          <span className="w-36 shrink-0 text-white/65">{label}</span>
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
            <span className="absolute inset-y-0 left-0 rounded-full bg-ok/60" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="w-10 text-right tabular-nums">{n}</span>
          <span className="w-12 text-right text-[12px] text-white/40 tabular-nums">
            {i > 0 && steps[i - 1][1] ? `${Math.round((n / steps[i - 1][1]) * 100)}%` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Breakdown({
  title,
  rows,
  label = (k) => k,
}: {
  title: string;
  rows: { key: string; counts: Counts }[];
  label?: (k: string) => string;
}) {
  return (
    <Card className="overflow-x-auto p-5">
      <Eyebrow className="mb-3">{title}</Eyebrow>
      <table className="w-full min-w-[640px] text-[13px]">
        <thead className="text-white/40">
          <tr>
            {["", "Leady", "Pridelené", "Skúšané", "Rozhovor", "Súhlas", "Záujem", "Predaj", "Zaplatené €"].map((h) => (
              <th key={h} className={cn("py-1.5 font-normal", h ? "text-right" : "text-left")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, counts: c }) => (
            <tr key={key} className="border-t border-line/60">
              <td className="py-1.5">{label(key)}</td>
              <td className="text-right tabular-nums">{c.leads}</td>
              <td className="text-right tabular-nums">{c.assigned}</td>
              <td className="text-right tabular-nums">{c.attempted}</td>
              <td className="text-right tabular-nums">{c.conversation}</td>
              <td className="text-right tabular-nums">
                {c.consent} <span className="text-white/35">{c.conversation ? `(${Math.round((c.consent / c.conversation) * 100)}%)` : ""}</span>
              </td>
              <td className="text-right tabular-nums">{c.interest}</td>
              <td className="text-right tabular-nums">{c.sale}</td>
              <td className="text-right tabular-nums">{c.revenue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
