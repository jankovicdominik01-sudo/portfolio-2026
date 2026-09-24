import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Web analysis service: stiahne web firmy (úvod + pár podstránok) a vytiahne
 * z neho iba overiteľné fakty. Nič neinterpretuje — to robí analýza.
 */

export type PageKind = "home" | "contact" | "gallery" | "services" | "about";

export type PageFacts = {
  url: string;
  kind: PageKind;
  status: number;
  title: string | null;
  metaDescription: string | null;
  hasViewport: boolean;
  h1: string[];
  headings: string[];
  navLinks: { text: string; href: string }[];
  telLinks: string[];
  mailLinks: string[];
  phonesInText: string[];
  imageCount: number;
  hasForm: boolean;
  hasOpeningHours: boolean;
  socialLinks: string[];
  copyrightYear: number | null;
  /** Prvých ~500 znakov viditeľného textu (to, čo človek vidí hore). */
  topText: string;
  text: string;
  /** Poradie prvého výskytu telefónu vo viditeľnom texte (0–1), null ak nie je. */
  phonePosition: number | null;
  /** Stránka má takmer žiadny text v HTML a obsah dopĺňa až JavaScript. */
  jsRendered: boolean;
};

export type SiteFacts = {
  input: string;
  ok: boolean;
  error: string | null;
  fetchedAt: string;
  finalUrl: string | null;
  https: boolean;
  pages: PageFacts[];
};

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function isPrivateIp(ip: string) {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Ochrana proti SSRF — iba verejné http(s) adresy. */
async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol)) throw new Error("Nepodporovaný protokol");
  const host = u.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Neverejná adresa");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivateIp)) throw new Error("Neverejná adresa");
  return u;
}

async function fetchHtml(url: string, redirects = 0): Promise<{ status: number; html: string; url: string }> {
  const u = await assertPublicUrl(url);
  const res = await fetch(u, {
    redirect: "manual",
    headers: { "user-agent": UA, accept: "text/html,*/*", "accept-language": "sk,cs;q=0.8,en;q=0.5" },
    signal: AbortSignal.timeout(9000),
  });
  if (res.status >= 300 && res.status < 400 && res.headers.get("location") && redirects < 5) {
    return fetchHtml(new URL(res.headers.get("location")!, u).toString(), redirects + 1);
  }
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) return { status: res.status, html: "", url: u.toString() };
  const buf = await res.arrayBuffer();
  const html = new TextDecoder("utf-8").decode(buf.slice(0, 1_500_000));
  return { status: res.status, html, url: u.toString() };
}

/* ─────────────── HTML → fakty (bez závislostí, odolné voči zlému HTML) ─────────────── */

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const clean = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function all(re: RegExp, html: string, group = 1): string[] {
  return [...html.matchAll(re)].map((m) => m[group]).filter(Boolean);
}

const PHONE_RE = /(?:\+421|00421|0)\s?\d{3}\s?\d{3}\s?\d{3}|(?:\+421|0)\s?\d{2,3}\s?\/?\s?\d{2,3}\s?\d{2}\s?\d{2}/g;

export function normalizePhone(p: string): string {
  let d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = `+${d.slice(2)}`;
  if (d.startsWith("0")) d = `+421${d.slice(1)}`;
  return d;
}

function parsePage(url: string, kind: PageKind, status: number, html: string): PageFacts {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  const text = clean(body);

  const links = [...body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    href: m[1],
    text: clean(m[2]).slice(0, 60),
  }));
  const navBlock = body.match(/<nav[\s\S]*?<\/nav>/i)?.[0] ?? body.match(/<header[\s\S]*?<\/header>/i)?.[0] ?? "";
  const navLinks = [...navBlock.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: m[1], text: clean(m[2]).slice(0, 40) }))
    .filter((l) => l.text)
    .slice(0, 15);

  const phonesInText = [...new Set((text.match(PHONE_RE) ?? []).map((p) => p.trim()))].slice(0, 5);
  const firstPhone = text.search(PHONE_RE);
  const years = all(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi, html).map(Number);

  return {
    url,
    kind,
    status,
    title: clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null,
    metaDescription:
      decode(html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? "").trim() ||
      null,
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    h1: all(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, body).map(clean).filter(Boolean).slice(0, 3),
    headings: all(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi, body).map(clean).filter(Boolean).slice(0, 20),
    navLinks,
    telLinks: [...new Set(links.filter((l) => /^tel:/i.test(l.href)).map((l) => l.href.slice(4)))],
    mailLinks: [...new Set(links.filter((l) => /^mailto:/i.test(l.href)).map((l) => l.href.slice(7).split("?")[0]))],
    phonesInText,
    imageCount: (body.match(/<img\b/gi) ?? []).length,
    hasForm: /<form\b/i.test(body) && /<(input|textarea)\b/i.test(body),
    hasOpeningHours: /otv[aá]racie hodiny|po\s*[-–]\s*pi|pondelok|otvorené/i.test(text),
    socialLinks: [
      ...new Set(
        links
          .map((l) => l.href)
          .filter((h) => /facebook\.com|instagram\.com|tiktok\.com|youtube\.com|linkedin\.com/i.test(h))
          .map((h) => h.split("?")[0]),
      ),
    ].slice(0, 5),
    copyrightYear: years.length ? Math.max(...years) : null,
    topText: text.slice(0, 500),
    text: text.slice(0, 6000),
    phonePosition: firstPhone >= 0 && text.length ? Math.round((firstPhone / text.length) * 100) / 100 : null,
    jsRendered: text.length < 300 && /<script\b/i.test(html),
  };
}

const SUBPAGES: [PageKind, RegExp][] = [
  ["gallery", /gal[eé]ri|realiz|referenc|portf[oó]li|fotk|na[sš]a pr[aá]ca|projekty/i],
  ["services", /slu[zž]b|ponuk|čo rob|co rob|produkt|sortiment|cenn[ií]k/i],
  ["contact", /kontakt/i],
  ["about", /o n[aá]s|o firme|o mne/i],
];

export async function fetchSite(website: string): Promise<SiteFacts> {
  const fetchedAt = new Date().toISOString();
  try {
    const home = await fetchHtml(website);
    if (!home.html) {
      return {
        input: website,
        ok: false,
        error: `Web neodpovedá ako HTML stránka (HTTP ${home.status}).`,
        fetchedAt,
        finalUrl: home.url,
        https: home.url.startsWith("https:"),
        pages: [],
      };
    }
    const homeFacts = parsePage(home.url, "home", home.status, home.html);
    const origin = new URL(home.url).origin;
    const allLinks = [...home.html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
      href: m[1],
      text: clean(m[2]),
    }));

    const picked = new Map<PageKind, string>();
    for (const [kind, re] of SUBPAGES) {
      const hit = allLinks.find((l) => re.test(l.text) || re.test(l.href));
      if (!hit) continue;
      try {
        const u = new URL(hit.href, home.url);
        if (u.origin === origin && u.toString() !== home.url && ![...picked.values()].includes(u.toString())) {
          picked.set(kind, u.toString());
        }
      } catch {
        /* neplatný odkaz */
      }
    }

    const sub = await Promise.all(
      [...picked.entries()].map(async ([kind, url]) => {
        try {
          const r = await fetchHtml(url);
          return r.html ? parsePage(r.url, kind, r.status, r.html) : null;
        } catch {
          return null;
        }
      }),
    );

    return {
      input: website,
      ok: home.status < 400,
      error: home.status >= 400 ? `Web vrátil chybu HTTP ${home.status}.` : null,
      fetchedAt,
      finalUrl: home.url,
      https: home.url.startsWith("https:"),
      pages: [homeFacts, ...sub.filter((p): p is PageFacts => !!p)],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "neznáma chyba";
    return {
      input: website,
      ok: false,
      error: /abort|timeout/i.test(msg) ? "Web sa nenačítal do 9 sekúnd." : `Web sa nepodarilo načítať (${msg}).`,
      fetchedAt,
      finalUrl: null,
      https: website.startsWith("https:"),
      pages: [],
    };
  }
}
