import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { Card, EmptyState, cn } from "@/components/ui";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { MarkAllRead } from "@/components/mark-read";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox" };

const ICON = { qualified: "🔥", new_leads: "🌱", info: "ℹ️" } as const;

export default async function InboxPage() {
  await requireUser("admin");
  const items = await (await db()).listNotifications();
  const unread = items.filter((n) => !n.read).length;
  return (
    <div>
      <FadeIn className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-[-0.035em]">Inbox</h1>
          <p className="mt-1 text-[15px] text-white/45">{unread ? `${unread} neprečítané` : "Všetko prečítané"}</p>
        </div>
        {unread ? <MarkAllRead /> : null}
      </FadeIn>
      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState icon="📭" title="Zatiaľ žiadne správy." body="Keď kamarát odovzdá lead, uvidíš ho tu." />
        ) : (
          <Card className="p-2">
            <Stagger>
              {items.map((n) => (
                <StaggerItem key={n.id}>
                  <Link
                    href={n.lead_id ? `/leads/${n.lead_id}` : "/"}
                    className="flex gap-4 rounded-2xl px-4 py-3.5 transition hover:bg-white/[0.035]"
                  >
                    <span className="mt-0.5 text-lg">{ICON[n.kind]}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[15px]", n.read ? "text-white/60" : "font-medium text-white")}>
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-white/40">{n.body}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-white/30">{fmtDateTime(n.at)}</span>
                    {!n.read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-ok" /> : null}
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </Card>
        )}
      </div>
    </div>
  );
}
