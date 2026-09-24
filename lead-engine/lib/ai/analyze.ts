import "server-only";
import type { Analysis, CallBrief, Company, Offer } from "../types";
import { fetchSite } from "./web";
import { collectEvidence } from "./signals";
import { analyzeWithRules } from "./rules";
import { analyzeWithClaude, claudeAvailable } from "./claude";
import { CALL_GOAL, defaultObjections, matchOffer, offerLine } from "./brief";
import { findBannedPhrases } from "./guard";

/**
 * Analysis pipeline: WEB CHECK → EVIDENCE → ANALYSIS (Claude alebo pravidlá) → CALL BRIEF.
 * Oddelené od UI — volá ju formulár, import aj API rannej rutiny.
 */
export async function runAnalysis(company: Company, offers: Offer[]) {
  const site = company.website ? await fetchSite(company.website) : null;
  const { evidence, signals } = collectEvidence(company, site);
  const rules = analyzeWithRules({ company, signals, evidence, offers });

  let analysis: Analysis = rules.analysis;
  let brief: CallBrief = rules.brief;

  if (claudeAvailable()) {
    const offer = matchOffer(offers, company.category);
    try {
      const { output, model } = await analyzeWithClaude({ company, site, signals, evidence, offer });
      const ids = new Set(evidence.map((e) => e.id));
      const warnings: string[] = [];
      const keepSourced = (claims: { text: string; evidence_ids: string[] }[], label: string) =>
        claims
          .map((c) => ({ ...c, evidence_ids: c.evidence_ids.filter((id) => ids.has(id)) }))
          .filter((c) => {
            if (c.evidence_ids.length) return true;
            warnings.push(`Vyradené ${label} bez zdroja: „${c.text}“`);
            return false;
          });

      const banned = findBannedPhrases([
        output.primary_hook,
        output.brief.natural_pitch,
        output.brief.call_opening,
        output.why_this_lead,
      ]);
      if (banned.length) warnings.push(`Text obsahuje generické frázy: ${banned.join(", ")}`);

      analysis = {
        engine: "claude",
        model,
        analyzed_at: new Date().toISOString(),
        company_summary: output.company_summary,
        why_this_lead: output.why_this_lead,
        positive_points: keepSourced(output.positive_points, "pozitívum"),
        observations: keepSourced(output.observations, "pozorovanie"),
        customer_risk: output.customer_risk,
        customer_gap: output.customer_gap,
        opportunity: output.opportunity,
        primary_hook: output.nothing_found ? null : output.primary_hook,
        secondary_hook: output.secondary_hook,
        nothing_found: output.nothing_found,
        confidence: output.confidence,
        evidence,
        warnings: [...warnings, ...rules.analysis.warnings.filter((w) => w.includes("Telefón"))],
      };
      brief = {
        ...output.brief,
        what_not_to_say: output.brief.what_not_to_say.length ? output.brief.what_not_to_say : rules.brief.what_not_to_say,
        objections: output.brief.objections.length
          ? output.brief.objections
          : defaultObjections(!!offer, offer?.estimated_price ?? null),
        // Ponuka a cena vždy iba z DB — AI ich nevymýšľa.
        offer: offer ? offerLine(offer) : null,
        offer_id: offer?.id ?? null,
        estimated_price: offer?.estimated_price ?? null,
        goal: CALL_GOAL,
      };
    } catch (e) {
      analysis = {
        ...rules.analysis,
        warnings: [
          `AI analýza zlyhala (${e instanceof Error ? e.message : "chyba"}), použili sme pravidlovú analýzu.`,
          ...rules.analysis.warnings,
        ],
      };
    }
  }

  return { analysis, brief, signals };
}
