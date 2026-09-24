import { requireUser, configuredUsers } from "@/lead-engine/lib/auth";
import { db } from "@/lead-engine/lib/db";
import { claudeAvailable } from "@/lead-engine/lib/ai/claude";
import { Card, Eyebrow, Section } from "@/lead-engine/components/ui";
import { FadeIn } from "@/lead-engine/components/motion";
import { OffersEditor } from "@/lead-engine/components/offers-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nastavenia" };

export default async function SettingsPage() {
  await requireUser("admin");
  const repo = await db();
  const offers = await repo.listOffers();
  const { users, demo } = configuredUsers();
  const storage = {
    supabase: "Supabase (Postgres)",
    blob: "Vercel Blob — testovacie úložisko",
    file: "Lokálny súbor (.data/db.json)",
  }[repo.kind];

  return (
    <div>
      <FadeIn>
        <h1 className="text-[32px] font-semibold tracking-[-0.035em]">Nastavenia</h1>
      </FadeIn>

      <div className="mt-8 space-y-5">
        <FadeIn delay={0.05}>
          <Section icon="💰" title="Rozpracované weby (existing_offer)">
            <p className="mb-5 max-w-2xl text-[14px] text-white/50">
              Príbeh „Dominikovi ostal rozpracovaný web“ sa v call briefe zobrazí <b className="text-white/80">iba</b> pre
              segment, kde je tu reálny projekt označený ako dostupný. Cenu ani web si AI nikdy nevymýšľa.
            </p>
            <OffersEditor offers={offers} />
          </Section>
        </FadeIn>

        <div className="grid gap-5 md:grid-cols-2">
          <FadeIn delay={0.1}>
            <Section icon="👥" title="Používatelia">
              <ul className="space-y-2.5">
                {users.map((u) => (
                  <li key={u.username} className="flex justify-between text-[14px]">
                    <span>
                      {u.name} <span className="text-white/35">· {u.username}</span>
                    </span>
                    <span className="text-white/45">{u.role === "admin" ? "Admin" : "Volajúci"}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12px] text-white/35">
                {demo
                  ? "Lokálne demo účty. Na serveri nastav LE_USERS."
                  : "Účty sa nastavujú v premennej LE_USERS (meno|Meno|rola|heslo; …)."}
              </p>
            </Section>
          </FadeIn>
          <FadeIn delay={0.14}>
            <Section icon="⚙️" title="Systém">
              <dl className="space-y-2.5 text-[14px]">
                <Row k="Úložisko" v={storage} />
                <Row k="Analýza" v={claudeAvailable() ? `Claude (${process.env.AI_MODEL || "claude-opus-5"})` : "Pravidlá (bez AI kľúča)"} />
                <Row k="Automatizácia API" v={process.env.LE_API_KEY ? "Zapnutá (Bearer kľúč)" : "Vypnutá — nastav LE_API_KEY"} />
              </dl>
            </Section>
          </FadeIn>
        </div>

        <FadeIn delay={0.18}>
          <Card className="p-6">
            <Eyebrow>🔌 API pre rannú rutinu</Eyebrow>
            <div className="mt-4 space-y-2 font-mono text-[12.5px] text-white/60">
              <div>
                <span className="text-green-300">POST</span> /api/v1/routines/morning{" "}
                <span className="text-white/30">{"{ query, candidates[] }"}</span>
              </div>
              <div>
                <span className="text-green-300">POST</span> /api/v1/leads{" "}
                <span className="text-white/30">{"{ leads[], analyze }"}</span>
              </div>
              <div>
                <span className="text-blue-300">GET</span> /api/v1/leads?status=ready_to_call
              </div>
              <div>
                <span className="text-green-300">POST</span> /api/v1/leads/:id/analyze
              </div>
              <div>
                <span className="text-blue-300">GET</span> /api/v1/leads/:id
              </div>
            </div>
            <p className="mt-4 text-[12px] text-white/35">Hlavička: Authorization: Bearer $LE_API_KEY</p>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/40">{k}</dt>
      <dd className="text-right text-white/80">{v}</dd>
    </div>
  );
}
