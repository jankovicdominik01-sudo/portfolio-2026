/**
 * Routing leadov medzi volajúcich (Soňa / Jozo). Čisté funkcie — testovateľné.
 *
 * Predvolený volajúci je v CATEGORIES (segment → call flow), NIE podľa pohlavia volajúceho.
 * Dominik ho mení v Nastaveniach (Settings.routing). Automaticky sa routing NEPREPISUJE —
 * štatistiky caller × kategória × krajina sa iba zbierajú (Analytika).
 */
import { CATEGORIES, categoryOf, type CategoryId, type Settings } from "./types";

export type Route = { caller: string | null; reasons: string[] };

export function defaultRouting(): Record<CategoryId, string | null> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, c.caller])) as Record<CategoryId, string | null>;
}

/** Aktuálny routing = predvolený + zmeny z nastavení. */
export function effectiveRouting(settings: Pick<Settings, "routing"> | null | undefined): Record<string, string | null> {
  return { ...defaultRouting(), ...(settings?.routing ?? {}) };
}

/**
 * Komu lead patrí. Poradie: odporúčanie radaru (ak je volajúci aktívny) → routing kategórie → iný aktívny volajúci.
 */
export function routeLead(
  category: string,
  recommended: string | null | undefined,
  routing: Record<string, string | null>,
  active: string[],
): Route {
  const reasons: string[] = [];
  const cat = categoryOf(category);
  const byRouting = routing[cat.id] ?? null;
  if (recommended && active.includes(recommended) && (!byRouting || byRouting === recommended)) {
    reasons.push(`${cat.label} → ${recommended} (odporúčanie radaru)`);
    return { caller: recommended, reasons };
  }
  if (byRouting && active.includes(byRouting)) {
    reasons.push(`${cat.label} → ${byRouting} (routing)`);
    return { caller: byRouting, reasons };
  }
  const fallback = active[0] ?? null;
  if (fallback) reasons.push(`${byRouting ?? "nikto"} nie je aktívny → ${fallback}`);
  return { caller: fallback, reasons };
}

/** Kategórie, ktoré má volajúci podľa routingu (pre ranný plán discovery). */
export function categoriesFor(caller: string, routing: Record<string, string | null>): CategoryId[] {
  return CATEGORIES.filter((c) => c.id !== "ine" && routing[c.id] === caller).map((c) => c.id);
}
