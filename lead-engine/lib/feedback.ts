/**
 * Spätná väzba volajúceho = senzor kvality dát. Čisté funkcie (testovateľné).
 *
 *  - každá spätná väzba označí lead na preverenie (needs_reverify) — rutina ho pri najbližšom recheck-u pozrie,
 *  - „má iný web“ uloží URL ako kandidáta a stav webu prepne na NEISTÝ (kým ho radar neoverí),
 *  - „zlý web“ doménu odmietne (už sa firme znova nepriradí),
 *  - „firma neexistuje / duplicita / nie je cieľ“ vyradí lead z fronty volajúceho na kontrolu Dominikom.
 */
import type { Company, Feedback, FeedbackKind, Lead, RadarProfile } from "./types";

export type FeedbackInput = { kind: FeedbackKind; note: string | null; url: string | null };

const OUT_OF_QUEUE: FeedbackKind[] = ["business_gone", "duplicate", "not_target"];

const host = (u: string) => {
  try {
    return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

export function applyFeedback(
  lead: Lead,
  company: Company,
  input: FeedbackInput,
  by: string,
  nowIso: string,
  id: string,
): { lead: Partial<Lead>; company: Partial<Company>; event: string } {
  const fb: Feedback = { id, kind: input.kind, note: input.note, url: input.url, by, at: nowIso, resolved_at: null };
  const leadPatch: Partial<Lead> = { feedback: [...(lead.feedback ?? []), fb], needs_reverify: true, updated_at: nowIso };
  const companyPatch: Partial<Company> = {};
  const prof: RadarProfile | null = company.profile ? structuredClone(company.profile) : null;
  const dom = input.url ? host(input.url) : null;
  let event = `Spätná väzba volajúceho: ${input.kind}${input.note ? ` — ${input.note}` : ""}`;

  if (input.kind === "has_other_web") {
    leadPatch.website_resolution = "uncertain";
    if (dom && prof) {
      prof.websites = [...(prof.websites ?? []), { url: `https://${dom}`, domain: dom, verdict: "reported", sources: ["caller"], evidence: [`${by}: firma uviedla tento web`] }];
    }
    if (dom) event += ` (web: ${dom})`;
  }
  if (input.kind === "wrong_web") {
    leadPatch.website_resolution = "uncertain";
    const bad = prof?.website?.domain ?? host(company.website ?? "");
    if (prof && bad) {
      prof.rejected_websites = [...(prof.rejected_websites ?? []), { domain: bad, why: `volajúci ${by}: nie je ich web`, source: ["caller"] }];
      prof.website = { url: null, domain: null, status: "uncertain", confidence: null, evidence: [], health: null };
    }
    if (bad) companyPatch.website = null;
  }
  if (OUT_OF_QUEUE.includes(input.kind) && (lead.status === "ready_to_call" || lead.status === "called")) {
    leadPatch.status = "analyzed";
    leadPatch.next_action = "review";
    event += " → z fronty volajúceho na kontrolu";
  }
  if (prof) companyPatch.profile = prof;
  return { lead: leadPatch, company: companyPatch, event };
}
