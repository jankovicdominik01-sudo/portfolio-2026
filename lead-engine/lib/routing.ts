/**
 * Routing leadov medzi volajúcich (operátorov). Čisté funkcie — testovateľné.
 *
 * Soňa a Jozo sú legacy: ich pôvodné priradenie v CATEGORIES ostáva kvôli histórii
 * a analytike, ale predvolený routing ich ignoruje (segment bez operátora → prvý aktívny).
 *
 * Predvolený volajúci je v CATEGORIES (segment → call flow), NIE podľa pohlavia volajúceho.
 * Dominik ho mení v Nastaveniach (Settings.routing). Automaticky sa routing NEPREPISUJE —
 * štatistiky caller × kategória × krajina sa iba zbierajú (Analytika).
 */
import { isLegacy } from "./operators";
import { CATEGORIES, categoryOf, type CategoryId, type Settings } from "./types";

export type Route = { caller: string | null; reasons: string[] };

export function defaultRouting(): Record<CategoryId, string | null> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, isLegacy(c.caller) ? null : c.caller])) as Record<CategoryId, string | null>;
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
  if (recommended && !isLegacy(recommended) && active.includes(recommended) && (!byRouting || byRouting === recommended)) {
    reasons.push(`${cat.label} → ${recommended} (odporúčanie radaru)`);
    return { caller: recommended, reasons };
  }
  if (byRouting && !isLegacy(byRouting) && active.includes(byRouting)) {
    reasons.push(`${cat.label} → ${byRouting} (routing)`);
    return { caller: byRouting, reasons };
  }
  const fallback = active.find((a) => !isLegacy(a)) ?? null;
  if (fallback) reasons.push(byRouting ? `${byRouting} nie je aktívny → ${fallback}` : `${cat.label}: segment bez vlastného operátora → ${fallback}`);
  return { caller: fallback, reasons };
}

/** Kategórie, ktoré má volajúci podľa routingu (pre ranný plán discovery). */
export function categoriesFor(caller: string, routing: Record<string, string | null>): CategoryId[] {
  return CATEGORIES.filter((c) => c.id !== "ine" && routing[c.id] === caller).map((c) => c.id);
}
