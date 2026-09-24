/** Formátovanie dátumov — vždy v slovenskom čase, nech server na Verceli neukazuje UTC. */
const TZ = "Europe/Bratislava";

export function fmtDate(iso: string | null | undefined, withYear = true) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("sk-SK", {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(iso));
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sk-SK", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return `${fmtDate(iso, false)} o ${fmtTime(iso)}`;
}

/** „dnes“, „včera“, „pred 3 dňami“, „zajtra“… */
export function fmtRelative(iso: string | null | undefined) {
  if (!iso) return "";
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const a = new Date(day(new Date(iso))).getTime();
  const b = new Date(day(new Date())).getTime();
  const diff = Math.round((a - b) / 86_400_000);
  if (diff === 0) return `dnes ${fmtTime(iso)}`;
  if (diff === -1) return "včera";
  if (diff === 1) return "zajtra";
  if (diff < 0) return `pred ${-diff} ${-diff < 5 ? "dňami" : "dňami"}`;
  return `o ${diff} ${diff < 5 ? "dni" : "dní"}`;
}

export function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date()));
  if (h < 10) return "Dobré ráno";
  if (h < 18) return "Dobrý deň";
  return "Dobrý večer";
}

/** Koniec dňa (dnes + offset) v slovenskom čase ako ISO. */
export function endOfDay(offsetDays: number) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  return new Date(`${ymd}T21:59:59.000Z`).toISOString();
}

export function addDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString();
}

export function isDue(iso: string | null | undefined) {
  return !iso || new Date(iso).getTime() <= new Date(endOfDay(0)).getTime();
}

export function telHref(phone: string | null | undefined) {
  if (!phone) return undefined;
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function displayUrl(url: string | null | undefined) {
  if (!url) return "";
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}
