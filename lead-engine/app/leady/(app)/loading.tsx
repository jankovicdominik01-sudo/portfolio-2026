export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Načítavam">
      <div className="h-10 w-64 overflow-hidden rounded-2xl bg-white/[0.03]">
        <div className="shimmer h-full w-full" />
      </div>
      <div className="h-40 overflow-hidden rounded-[22px] bg-white/[0.025]">
        <div className="shimmer h-full w-full" />
      </div>
      <div className="h-40 overflow-hidden rounded-[22px] bg-white/[0.02]">
        <div className="shimmer h-full w-full" />
      </div>
    </div>
  );
}
