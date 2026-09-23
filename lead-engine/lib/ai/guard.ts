/**
 * Zakázané generické AI frázy. Ak sa objavia vo výstupe, analýza dostane
 * varovanie a Claude je v prompte výslovne upozornený, aby ich nepoužil.
 */
export const BANNED_PHRASES = [
  "v dnešnej digitálnej dobe",
  "silná online prezentácia",
  "online viditeľnosť",
  "moderné riešenie na mieru",
  "oslovte viac zákazníkov",
  "digitálnu stopu",
  "digitálna transformácia",
  "digitálnej prezentácie",
  "používateľskej skúsenosti",
  "identifikovali priestor",
  "dovoľte mi predstaviť",
  "zastaraný web",
  "web je zastaraný",
];

export function findBannedPhrases(texts: (string | null | undefined)[]): string[] {
  const hay = texts.filter(Boolean).join(" \n ").toLowerCase();
  return BANNED_PHRASES.filter((p) => hay.includes(p));
}
