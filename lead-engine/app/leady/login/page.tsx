import { configuredUsers, setupStatus } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prihlásenie" };

export default function LoginPage() {
  const { users, demo } = configuredUsers();
  const setup = setupStatus();
  return (
    <main className="glow relative grid min-h-dvh place-items-center px-5 py-16">
      <div className="w-full max-w-[380px]">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 grid size-14 place-items-center rounded-[18px] bg-white/[0.04] ring-1 ring-line">
            <span className="text-lg font-semibold tracking-tight">
              DJ<span className="text-brand">.</span>
            </span>
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Lead Engine</h1>
          <p className="mt-2 text-[15px] text-white/45">Research → Call → Handoff → Deal</p>
        </div>
        {!setup.ready ? (
          <div className="rounded-3xl bg-white/[0.03] p-6 text-[14px] leading-relaxed text-white/70 ring-1 ring-line">
            <div className="text-[16px] font-semibold text-white">Ešte jeden krok</div>
            <p className="mt-2">
              Lead Engine potrebuje trvalé úložisko dát. Vo Verceli otvor projekt Lead Engine →{" "}
              <b className="text-white">Storage</b> →{" "}
              <b className="text-white">Create → Blob</b> (prístup <b className="text-white">Private</b>) a pripoj ho k projektu. Potom daj{" "}
              <b className="text-white">Redeploy</b>.
            </p>
            <p className="mt-2 text-white/45">Bez toho by sa firmy a hovory strácali.</p>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl bg-bad/10 p-4 text-sm text-red-200 ring-1 ring-bad/20">
            Prihlásenie nie je nastavené. Doplň premennú <code>LE_USERS</code> na serveri.
          </div>
        ) : (
          <LoginForm />
        )}
        {demo ? (
          <p className="mt-6 text-center text-xs text-white/35">
            Lokálny režim · <span className="text-white/60">dominik / dominik</span> alebo{" "}
            <span className="text-white/60">jozo / jozo</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
