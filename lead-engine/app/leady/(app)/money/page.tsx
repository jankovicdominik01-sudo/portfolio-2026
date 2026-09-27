import Link from "next/link";
import { requireUser, allUsers, userName } from "@/lib/auth";
import { db } from "@/lib/db";
import { earnings, compensationConfigured } from "@/lib/money";
import { COMMISSION_STATE_LABEL } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Card, Section } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { MarkPaid, MoneySettings } from "@/components/money-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Peniaze" };

export default async function MoneyPage() {
  await requireUser("admin");
  const r = await db();
  const [settings, commissions, leads, companies] = await Promise.all([
    r.getSettings(),
    r.listCommissions(),
    r.listLeads(),
    r.listCompanies(),
  ]);
  const nameOf = new Map(leads.map((l) => [l.id, companies.find((c) => c.id === l.company_id)?.name ?? "?"]));
  const now = new Date().toISOString();
  const callersAll = allUsers().filter((u) => u.role === "caller");
  const eur = (n: number) => `${n} €`;

  return (
    <div>
      <FadeIn>
        <h1 className="text-[32px] font-semibold tracking-[-0.035em]">Peniaze</h1>
        <p className="mt-1 text-[15px] text-white/45">
          {compensationConfigured(settings.compensation)
            ? "Pravidlo odmeny je nastavené."
            : "NEEDS CONFIGURATION — pravidlo odmeny zatiaľ nie je nastavené, sumy sa nezobrazujú."}
        </p>
      </FadeIn>

      <FadeIn delay={0.04} className="mt-6">
        <Section icon="⚙️" title="Nastavenie">
          <MoneySettings initial={settings} />
        </Section>
      </FadeIn>

      <FadeIn delay={0.08} className="mt-5 grid gap-3 sm:grid-cols-2">
        {callersAll.map((u) => {
          const e = earnings(commissions, u.username, now);
          return (
            <Card key={u.username} className="p-5">
              <div className="text-[15px] font-medium">
                {u.name} {u.active ? "" : <span className="text-white/35">(história)</span>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[13px]">
                <dt className="text-white/45">Tento mesiac potvrdené</dt>
                <dd className="text-right">{eur(e.month)}</dd>
                <dt className="text-white/45">Čaká</dt>
                <dd className="text-right">{eur(e.pending)}</dd>
                <dt className="text-white/45">Vyplatené</dt>
                <dd className="text-right">{eur(e.paid)}</dd>
                <dt className="text-white/45">Bez sumy</dt>
                <dd className="text-right">{e.unpriced}</dd>
              </dl>
            </Card>
          );
        })}
      </FadeIn>

      <FadeIn delay={0.12} className="mt-5">
        <Section icon="🧾" title="Odmeny">
          {commissions.length ? (
            <table className="w-full text-[13px]">
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-b border-line/60">
                    <td className="py-2">
                      <Link href={`/leady/leads/${c.lead_id}`} className="hover:underline">
                        {nameOf.get(c.lead_id)}
                      </Link>
                      <div className="text-white/40">
                        {userName(c.user)} · {c.kind === "handoff" ? "handoff" : "predaj"} · {fmtDate(c.created_at)}
                      </div>
                    </td>
                    <td className="text-right">{c.amount !== null ? eur(c.amount) : "—"}</td>
                    <td className="px-3 text-right text-white/60">{COMMISSION_STATE_LABEL[c.state]}</td>
                    <td className="text-right">{c.state === "confirmed" ? <MarkPaid id={c.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[14px] text-white/45">Zatiaľ žiadne odmeny.</p>
          )}
        </Section>
      </FadeIn>
    </div>
  );
}
