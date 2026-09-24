import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <div className="text-[22px] font-semibold tracking-tight">Toto sme nenašli.</div>
        <p className="mt-2 text-white/45">Lead možno už nie je v tvojom zozname.</p>
        <Link href="/leady" className="mt-6 inline-block text-sm text-white/70 underline underline-offset-4">
          Späť na Dnes
        </Link>
      </div>
    </main>
  );
}
