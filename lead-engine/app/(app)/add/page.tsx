import { requireUser } from "@/lib/auth";
import { FadeIn } from "@/components/motion";
import { Card, Eyebrow } from "@/components/ui";
import { NewLeadForm, ImportBox } from "@/components/add-forms";

export const metadata = { title: "Pridať firmu" };
export const maxDuration = 120;

export default async function AddPage() {
  await requireUser("admin");
  return (
    <div>
      <FadeIn>
        <h1 className="text-[32px] font-semibold tracking-[-0.035em]">Pridať firmu</h1>
        <p className="mt-1 text-[15px] text-white/45">
          Systém skontroluje duplicity, overí web a pripraví call brief.
        </p>
      </FadeIn>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <FadeIn delay={0.05}>
          <Card className="p-6 sm:p-7">
            <Eyebrow>Nový lead</Eyebrow>
            <NewLeadForm />
          </Card>
        </FadeIn>
        <FadeIn delay={0.1}>
          <Card className="p-6 sm:p-7">
            <Eyebrow>Import CSV / JSON</Eyebrow>
            <ImportBox />
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
