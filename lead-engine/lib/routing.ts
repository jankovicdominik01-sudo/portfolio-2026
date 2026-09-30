/**
 * Routing leadov medzi operátorov. Čisté funkcie, testovateľné.
 *
 * Segment nemá natvrdo priradeného človeka. Dominik môže segment priradiť konkrétnemu
 * operátorovi v Nastaveniach (Settings.routing); inak lead dostane prvý aktívny operátor.
 * Automaticky sa routing NEPREPISUJE, štatistiky sa iba zbierajú (Analytika).
 */
import { CATEGORIES, categoryOf, type CategoryId, type Settings } from "./types";

export type Route = { caller: string | null; reasons: string[] };

/** Bez nastavenia nemá žiadny segment vlastného operátora. */
export function defaultRouting(): Record<CategoryId, string | null> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, null])) as Record<CategoryId, string | null>;
}

/** Aktuálny routing = predvolený + zmeny z nastavení. */
export function effectiveRouting(settings: Pick<Settings, "routing"> | null | undefined): Record<string, string | null> {
  return { ...defaultRouting(), ...(settings?.routing ?? {}) };
}

/**
 * Komu lead patrí. Poradie: odporúčanie radaru (ak je aktívny operátor) → routing segmentu
 * → prvý aktívny operátor. `active` sú iba aktívni CALL operátori; nikto iný lead nedostane.
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
  if (fallback) reasons.push(`${cat.label} → ${fallback} (aktívny operátor)`);
  else reasons.push("Nie je aktívny operátor");
  return { caller: fallback, reasons };
}

/** Segmenty operátora pre ranný plán: výslovne jeho + nepriradené. */
export function categoriesFor(caller: string, routing: Record<string, string | null>): CategoryId[] {
  return CATEGORIES.filter((c) => c.id !== "ine" && (!routing[c.id] || routing[c.id] === caller)).map((c) => c.id);
}
