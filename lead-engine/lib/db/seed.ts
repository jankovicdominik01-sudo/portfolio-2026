import type { DbState } from "./types";

/**
 * Počiatočné dáta. Žiadne vymyslené firmy — iba reálny hotový web (pôvodný klient ho neprevzal),
 * ktorý Dominik môže ponúknuť (dá sa vypnúť v Nastaveniach).
 */
export function seedState(s: DbState): DbState {
  if (s.offers.length === 0) {
    s.offers.push({
      id: "offer_zahradnictvo",
      category: "zahradnictvo",
      available: true,
      estimated_price: 200,
      note: "Hotový web, ktorý pôvodný klient neprevzal — prispôsobí sa pre záhradníctvo / záhradné služby",
      preview_url: null,
      created_at: new Date().toISOString(),
    });
  }
  return s;
}
