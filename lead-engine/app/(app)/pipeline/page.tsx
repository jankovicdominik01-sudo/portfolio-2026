import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listLeads } from "@/lib/leads";
import { STATUS_LABEL, categoryOf, type LeadStatus } from "@/lib/types";
import { Card, EmptyState, PriorityTag } from "@/components/ui";
import { FadeIn } from "@/components/motion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline" };

const STAGES: LeadStatus[] = [
  "new",
  "analyzed",
  "ready_to_call",
  "called",
  "dominik_call",
  "offer_sent",
  "negotiation",
  "won",
  "lost",
];

/** Pipeline ako jednoduchý prehľad fáz — nie drag&drop kanban. */
export default async function PipelinePage() {
  const user = await requireUser("admin");
  const leads = await listLeads(user);
  const max = Math.max(1, ...STAGES.map((s) => leads.filter((l) => l.status === s).length));

  return (
    <div>
      <FadeIn>
        <h1 className="text-[32px] font-semibold tracking-[-0.035em]">Pipeline</h1>
        <p className="mt-1 text-[15px] text-white/45">Research → Call → Handoff → Deal</p>
      </FadeIn>

      {leads.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Pipeline je zatiaľ prázdna." body="Keď pridáš prvú firmu, uvidíš tu, kde sa ktorý lead nachádza." />
        </div>
      ) : (
        <div className="mt-8 space-y-2">
          {STAGES.map((s, i) => {
            const inStage = leads.filter((l) => l.status === s);
            return (
              <FadeIn key={s} delay={i * 0.03}>
                <Card className="p-4 sm:p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-44 shrink-0 text-[14px] text-white/70">{STATUS_LABEL[s]}</div>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-white/40 transition-all duration-700"
                        style={{ width: `${(inStage.length / max) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-right text-[14px] text-white/50 tabular-nums">{inStage.length}</div>
                  </div>
                  {inStage.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {inStage.slice(0, 12).map((l) => (
                        <Link
                          key={l.id}
                          href={`/leads/${l.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/75 ring-1 ring-inset ring-line transition hover:bg-white/[0.08] hover:text-white"
                        >
                          {categoryOf(l.company.category).emoji} {l.company.name}
                          {l.priority === "hot" ? <PriorityTag priority="hot" className="ml-0.5" /> : null}
                        </Link>
                      ))}
                      {inStage.length > 12 ? (
                        <Link href="/leads" className="px-2 py-1.5 text-[13px] text-white/35">
                          +{inStage.length - 12}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              </FadeIn>
            );
          })}
        </div>
      )}
    </div>
  );
}
