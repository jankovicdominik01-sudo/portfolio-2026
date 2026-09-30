import { requireUser, configuredUsers, callers } from "@/lib/auth";
import { configuredOperators } from "@/lib/operators";
import { db } from "@/lib/db";
import { claudeAvailable } from "@/lib/ai/claude";
import { Card, Eyebrow, Section } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { OffersEditor } from "@/components/offers-editor";
import { ReassignButton } from "@/components/reassign-button";
import { RoutingEditor } from "@/components/routing-editor";
import { defaultRouting } from "@/lib/routing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nastavenia" };

export default async function SettingsPage() {
  await requireUser("admin");
  const repo = await db();
  const [offers, settings] = await Promise.all([repo.listOffers(), repo.getSettings()]);
  const { users, demo } = configuredUsers();
  const ops = configuredOperators();
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
          <Section icon="💰" title="Hotový web na prispôsobenie (ponuka)">
            <p className="mb-5 max-w-2xl text-[14px] text-white/50">
              Veta „kamarátovi ostal hotový web, pôvodný klient ho neprevzal“ zaznie <b className="text-white/80">iba</b> pre
              segment, pre ktorý je tu web označený ako dostupný (commercial fit). Obsah balíka a odmenu nastavíš v Peniaze.
            </p>
            <OffersEditor offers={offers} />
          </Section>
        </FadeIn>

        <FadeIn delay={0.08}>
          <Section icon="🧭" title="Routing — kto volá ktorý segment">
            <p className="mb-5 max-w-2xl text-[14px] text-white/50">
              Nový CALL lead dostane aktívny operátor. Segment môžeš priradiť konkrétnemu operátorovi; bez priradenia ide prvému
              aktívnemu. Systém routing sám nemení, iba zbiera výsledky operátor × segment × krajina v Kvalite dát.
            </p>
            <RoutingEditor
              routing={settings.routing ?? {}}
              defaults={defaultRouting()}
              callers={callers().map((u) => ({ username: u.username, name: u.name }))}
            />
          </Section>
        </FadeIn>

        <div className="grid gap-5 md:grid-cols-2">
          <FadeIn delay={0.1}>
            <Section icon="👥" title="Používatelia">
              <ul className="space-y-2.5">
                {users.filter((u) => u.role === "admin" || ops.some((o) => o.operator_id === u.username)).map((u) => (
                  <li key={u.username} className="flex justify-between text-[14px]">
                    <span>
                      {u.name} <span className="text-white/35">· {u.username}</span>
                    </span>
                    <span className="text-white/45">
                      {u.role === "admin" ? "Admin" : `Operátor · ${ops.find((o) => o.operator_id === u.username)?.status ?? ""}`}
                      {u.active ? "" : " · účet vypnutý"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12px] text-white/35">
                {demo
                  ? "Lokálne demo účty. Na serveri nastav LE_USERS."
                  : "Účty sú v LE_USERS (meno|Meno|rola|scrypt hash|m), operátori v LE_OPERATORS. Volajúci bez záznamu operátora sa neprihlási."}
              </p>
              <div className="mt-4">
                <ReassignButton />
              </div>
            </Section>
          </FadeIn>
          <FadeIn delay={0.14}>
            <Section icon="⚙️" title="Systém">
              <dl className="space-y-2.5 text-[14px]">
                <Row k="Úložisko" v={storage} />
                <Row k="Analýza" v={claudeAvailable() ? `Claude (${process.env.AI_MODEL || "claude-opus-5"})` : "Pravidlá (bez AI kľúča)"} />
                <Row k="Automatizácia API" v="Zapnutá — ranná rutina (Bearer kľúč)" />
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
            <p className="mt-4 text-[12px] text-white/35">Hlavička: Authorization: Bearer &lt;kľúč rannej rutiny&gt;</p>
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
