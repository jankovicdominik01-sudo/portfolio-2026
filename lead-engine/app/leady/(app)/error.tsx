"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="text-[20px] font-semibold tracking-tight">Niečo sa pokazilo.</div>
      <p className="mt-2 text-white/45">Skús to znova. Ak to pretrváva, obnov stránku.</p>
      <button onClick={reset} className="mt-6 rounded-2xl bg-white px-5 py-2.5 text-sm font-medium text-black">
        Skúsiť znova
      </button>
    </div>
  );
}
