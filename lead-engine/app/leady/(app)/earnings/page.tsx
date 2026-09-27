import { requireUser } from "@/lib/auth";
import { myEarnings, myHandoffs, myToday } from "@/lib/leads";
import { COMMISSION_STATE_LABEL, STATUS_LABEL } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Card, Eyebrow, cn } from "@/components/ui";
import { FadeIn } from "@/components/motion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Zárobok" };

const eur = (n: number) => `${n.toLocaleString("sk-SK", { maximumFractionDigits: 2 })} €`;

/** Volajúci vidí iba svoje peniaze. Potvrdené ≠ čakajúce ≠ vyplatené. Nič potenciálne sa nerátá ako zarobené. */
export default async function EarningsPage() {
  const user = await requireUser();
  const [e, handoffs, today] = await Promise.all([myEarnings(user), myHandoffs(user), myToday(user)]);
  const leadName = new Map(handoffs.map((h) => [h.id, h.name]));

  return (
    <div>
      <FadeIn>
        <Eyebrow>Zárobok</Eyebrow>
        <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em]">{user.name}, tu sú tvoje peniaze</h1>
      </FadeIn>

      {!e.configured ? (
        <FadeIn delay={0.04} className="mt-5">
          <div className="rounded-2xl bg-warn/10 px-4 py-3.5 text-[14px] leading-relaxed text-yellow-100 ring-1 ring-warn/20">
            Pravidlo odmeny zatiaľ nie je nastavené (Dominik ho doplní). Tvoje súhlasy sa evidujú a suma sa k nim dopočíta
            hneď po nastavení.
          </div>
        </FadeIn>
      ) : null}

      <FadeIn delay={0.06} className="mt-6">
        <Eyebrow className="mb-2">Dnes</Eyebrow>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Tile label="Telefonáty" value={String(today.calls)} />
          <Tile label="Rozhovory" value={String(today.conversations)} />
          <Tile label="Súhlasy" value={String(today.consents)} tone="ok" />
        </div>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-6">
        <Eyebrow className="mb-2">Peniaze</Eyebrow>
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Dnes potvrdené" value={eur(e.today)} tone="ok" />
          <Tile label="Tento týždeň" value={eur(e.week)} />
          <Tile label="Tento mesiac" value={eur(e.month)} />
          <Tile label="Čaká na potvrdenie" value={eur(e.pending)} tone="warn" />
          <Tile label="Vyplatené" value={eur(e.paid)} className="col-span-2" />
        </div>
        {e.unpriced ? (
          <p className="mt-2 text-[13px] text-white/45">{e.unpriced} záznamov zatiaľ bez sumy (pravidlo nie je nastavené).</p>
        ) : null}
      </FadeIn>

      <FadeIn delay={0.14} className="mt-8">
        <Eyebrow className="mb-2">Detail odmien</Eyebrow>
        {e.items.length ? (
          <ul className="space-y-2">
            {e.items.map((x) => (
              <li key={x.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-medium">{leadName.get(x.lead_id) ?? "Firma"}</div>
                      <div className="mt-0.5 text-[13px] text-white/50">{x.reason}</div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[12px]",
                        x.state === "paid" || x.state === "confirmed" ? "bg-ok/15 text-green-200" : "bg-warn/10 text-yellow-200",
                      )}
                    >
                      {COMMISSION_STATE_LABEL[x.state]}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[13px]">
                    {x.sale_price !== null ? (
                      <>
                        <dt className="text-white/45">Cena webu</dt>
                        <dd>{eur(x.sale_price)}</dd>
                      </>
                    ) : null}
                    <dt className="text-white/45">Tvoja odmena</dt>
                    <dd className="font-medium">{x.amount !== null ? eur(x.amount) : "nenastavená"}</dd>
                    <dt className="text-white/45">Dôvod</dt>
                    <dd>{x.kind === "handoff" ? "súhlas s kontaktom (handoff)" : "predaj webu"}</dd>
                    <dt className="text-white/45">Nárok vznikol</dt>
                    <dd>{x.confirmed_at ? fmtDate(x.confirmed_at) : "—"}</dd>
                    <dt className="text-white/45">Vyplatené</dt>
                    <dd>{x.paid_at ? fmtDate(x.paid_at) : "—"}</dd>
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-white/45">Zatiaľ žiadne odmeny. Vzniknú, keď firma súhlasí s kontaktom od Dominika.</p>
        )}
      </FadeIn>

      <FadeIn delay={0.18} className="mt-8">
        <Eyebrow className="mb-2">Moje handoffy</Eyebrow>
        {handoffs.length ? (
          <ul className="divide-y divide-line rounded-2xl ring-1 ring-inset ring-line">
            {handoffs.map((h) => (
              <li key={h.id} className="flex items-center justify-between px-4 py-3 text-[14px]">
                <span className="min-w-0 truncate">
                  {h.name}
                  <span className="text-white/40"> · {fmtDate(h.at, false)}</span>
                </span>
                <span className="shrink-0 pl-3 text-white/55">{STATUS_LABEL[h.status]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-white/45">Zatiaľ žiadne.</p>
        )}
      </FadeIn>
    </div>
  );
}

function Tile({ label, value, tone, className }: { label: string; value: string; tone?: "ok" | "warn"; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-white/[0.03] px-3 py-3.5 ring-1 ring-inset ring-line", className)}>
      <div className={cn("text-[20px] font-semibold tabular-nums", tone === "ok" ? "text-green-300" : tone === "warn" ? "text-yellow-200" : "")}>
        {value}
      </div>
      <div className="text-[12px] text-white/45">{label}</div>
    </div>
  );
}
