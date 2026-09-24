import type { Claim, Evidence } from "@/lib/types";

const SOURCE_LABEL: Record<Evidence["source"], string> = {
  web: "Overené z webu",
  catalog: "Overené z katalógu",
  manual: "Zo záznamu leadu",
  call: "Z telefonátu",
};

/** Malý štítok zdroja pri každom tvrdení. Bez zdroja = „neoverené“. */
export function SourceTag({ ids, evidence }: { ids: string[]; evidence: Evidence[] }) {
  const ev = evidence.filter((e) => ids.includes(e.id));
  if (!ev.length) return <span className="ml-1 text-[11px] whitespace-nowrap text-red-300/70">· neoverené</span>;
  const first = ev[0];
  const label = SOURCE_LABEL[first.source];
  const title = ev.map((e) => `${e.id}: ${e.excerpt}`).join("\n");
  return first.url ? (
    <a
      href={first.url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="ml-1 text-[11px] whitespace-nowrap text-white/30 underline-offset-2 hover:text-white/70 hover:underline"
    >
      · {label}
    </a>
  ) : (
    <span title={title} className="ml-1 text-[11px] whitespace-nowrap text-white/30">
      · {label}
    </span>
  );
}

export function ClaimList({ claims, evidence, empty }: { claims: Claim[]; evidence: Evidence[]; empty: string }) {
  if (!claims.length) return <p className="text-[14px] text-white/40">{empty}</p>;
  return (
    <ul className="space-y-3">
      {claims.map((c, i) => (
        <li key={i} className="text-[15px] leading-relaxed text-white/80">
          {c.text}
          <SourceTag ids={c.evidence_ids} evidence={evidence} />
        </li>
      ))}
    </ul>
  );
}
