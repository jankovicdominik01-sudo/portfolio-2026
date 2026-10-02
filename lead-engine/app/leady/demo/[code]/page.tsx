import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { publicDemo } from "@/lib/leads";
import { DemoPreview } from "@/components/demo-preview";

/**
 * Interný náhľad dema (Phase 2): iba prihlásený admin, nič sa neodosiela.
 * Stránka dostane iba verejnú projekciu dema, rovnakú, akú raz uvidí firma.
 */
export const metadata: Metadata = {
  title: "Náhľad dema",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function DemoPage({ params }: { params: Promise<{ code: string }> }) {
  await requireUser("admin");
  const d = await publicDemo((await params).code);
  if (!d) {
    return (
      <div className="mx-auto max-w-[520px] px-4 py-20 text-center">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Demo nie je dostupné</h1>
        <p className="mt-2 text-[15px] text-white/55">Neexistuje, vypršalo alebo je vypnuté.</p>
        <Link href="/leady" className="mt-6 inline-block text-[14px] text-white/70 underline underline-offset-2">
          Späť do Lead Engine
        </Link>
      </div>
    );
  }
  return <DemoPreview d={d} />;
}
