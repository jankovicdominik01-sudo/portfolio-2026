import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listLeads } from "@/lib/leads";
import { CATEGORIES, categoryOf, type LeadStatus } from "@/lib/types";
import { ButtonLink, Card, EmptyState, cn } from "@/components/ui";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { LeadRow } from "@/components/lead-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leady" };

const FILTERS: { id: string; label: string; match: (s: LeadStatus) => boolean }[] = [
  { id: "active", label: "Aktívne", match: (s) => !["won", "lost", "archived"].includes(s) },
  { id: "new", label: "Nové", match: (s) => s === "new" || s === "analyzed" },
  { id: "ready", label: "Pripravené na telefonát", match: (s) => s === "ready_to_call" },
  { id: "called", label: "Volané", match: (s) => s === "called" },
  { id: "qualified", label: "Kvalifikované", match: (s) => s === "dominik_call" },
  { id: "offer", label: "Ponuka", match: (s) => s === "offer_sent" || s === "negotiation" },
  { id: "won", label: "Vyhrané", match: (s) => s === "won" },
  { id: "lost", label: "Stratené", match: (s) => s === "lost" },
  { id: "archived", label: "Vyradené", match: (s) => s === "archived" },
];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ f?: string; cat?: string }> }) {
  const user = await requireUser("admin");
  const { f = "active", cat } = await searchParams;
  const all = await listLeads(user);
  const filter = FILTERS.find((x) => x.id === f) ?? FILTERS[0];
  const leads = all.filter((l) => filter.match(l.status) && (!cat || l.company.category === cat));
  const usedCats = CATEGORIES.filter((c) => all.some((l) => l.company.category === c.id));
  const href = (nf: string, nc?: string) => `/leads?f=${nf}${nc ? `&cat=${nc}` : ""}`;

  return (
    <div>
      <FadeIn className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-[-0.035em]">Leady</h1>
          <p className="mt-1 text-[15px] text-white/45">{all.length} firiem v systéme</p>
        </div>
        <ButtonLink href="/add" variant="primary" size="sm">
          <Plus className="size-4" /> Nový lead
        </ButtonLink>
      </FadeIn>

      <FadeIn delay={0.05} className="scrollbar-none -mx-4 mt-6 flex gap-1.5 overflow-x-auto px-4">
        {FILTERS.map((x) => {
          const n = all.filter((l) => x.match(l.status)).length;
          return (
            <Link
              key={x.id}
              href={href(x.id, cat)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] ring-1 ring-inset transition",
                x.id === filter.id ? "bg-white text-black ring-white" : "text-white/55 ring-line hover:text-white",
              )}
            >
              {x.label}
              <span className={cn("ml-1.5", x.id === filter.id ? "text-black/40" : "text-white/25")}>{n}</span>
            </Link>
          );
        })}
      </FadeIn>
      {usedCats.length > 1 ? (
        <FadeIn delay={0.08} className="scrollbar-none -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
          <Link
            href={href(filter.id)}
            className={cn("shrink-0 rounded-full px-3 py-1 text-[12px]", !cat ? "text-white" : "text-white/40 hover:text-white")}
          >
            Všetky segmenty
          </Link>
          {usedCats.map((c) => (
            <Link
              key={c.id}
              href={href(filter.id, c.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-[12px]",
                cat === c.id ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white",
              )}
            >
              {c.emoji} {c.label}
            </Link>
          ))}
        </FadeIn>
      ) : null}

      <div className="mt-6">
        {leads.length ? (
          <Card className="p-2">
            <Stagger>
              {leads.map((l) => (
                <StaggerItem key={l.id}>
                  <LeadRow lead={l} showStatus />
                </StaggerItem>
              ))}
            </Stagger>
          </Card>
        ) : (
          <EmptyState
            title={all.length ? "V tomto filtri nič nie je." : "Zatiaľ tu nemáš žiadne nové leady."}
            body={cat ? `Segment: ${categoryOf(cat).label}` : undefined}
            action={
              <ButtonLink href="/add" variant="primary">
                <Plus className="size-4" /> Pridať firmu
              </ButtonLink>
            }
          />
        )}
      </div>
    </div>
  );
}
