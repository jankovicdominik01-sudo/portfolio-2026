import "server-only";
import { createOrMergeLead } from "./leads";
import { LeadInputSchema, type LeadSource, type SessionUser } from "./types";

/**
 * Import CSV / JSON → validácia → deduplikácia (cez createOrMergeLead).
 * Rovnakú funkciu používa aj Lead ingestion API a ranná rutina.
 */

const HEADER_MAP: Record<string, string> = {
  nazov: "name",
  "nazov firmy": "name",
  firma: "name",
  name: "name",
  company: "name",
  mesto: "city",
  city: "city",
  obec: "city",
  kraj: "region",
  region: "region",
  telefon: "phone",
  "tel.": "phone",
  tel: "phone",
  phone: "phone",
  mobil: "phone",
  email: "email",
  "e-mail": "email",
  mail: "email",
  web: "website",
  website: "website",
  "webova stranka": "website",
  url: "website",
  kategoria: "category",
  category: "category",
  segment: "category",
  odvetvie: "category",
  poznamka: "note",
  note: "note",
  adresa: "address",
  address: "address",
  kontakt: "contact_person",
  "kontaktna osoba": "contact_person",
  contact: "contact_person",
  zdroj: "source_url",
  source_url: "source_url",
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = [";", ",", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export function parseImport(
  text: string,
): { ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string } {
  const t = text.replace(/^﻿/, "").trim();
  if (!t) return { ok: false, error: "Súbor je prázdny." };

  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const data = JSON.parse(t);
      const arr = Array.isArray(data) ? data : Array.isArray(data.leads) ? data.leads : [data];
      return {
        ok: true,
        rows: arr.map((o: Record<string, unknown>) =>
          Object.fromEntries(Object.entries(o).map(([k, v]) => [HEADER_MAP[norm(k)] ?? k, v])),
        ),
      };
    } catch {
      return { ok: false, error: "JSON sa nedá prečítať." };
    }
  }

  const rows = parseCsv(t);
  if (rows.length < 2) return { ok: false, error: "CSV potrebuje hlavičku a aspoň jeden riadok." };
  const header = rows[0].map((h) => HEADER_MAP[norm(h)] ?? null);
  if (!header.includes("name")) return { ok: false, error: "V hlavičke chýba stĺpec „Názov“." };
  return {
    ok: true,
    rows: rows.slice(1).map((r) => {
      const o: Record<string, unknown> = {};
      header.forEach((k, i) => {
        if (k && r[i]?.trim()) o[k] = r[i].trim();
      });
      return o;
    }),
  };
}

export async function importRows(user: SessionUser, rows: Record<string, unknown>[], source: LeadSource) {
  let created = 0;
  let merged = 0;
  const invalid: { row: number; error: string }[] = [];
  const leadIds: string[] = [];
  for (const [i, raw] of rows.slice(0, 500).entries()) {
    const parsed = LeadInputSchema.safeParse({ ...raw, source });
    if (!parsed.success) {
      invalid.push({ row: i + 2, error: parsed.error.issues[0]?.message ?? "Neplatný riadok" });
      continue;
    }
    try {
      const r = await createOrMergeLead(user, parsed.data);
      if (r.created) {
        created++;
        leadIds.push(r.leadId);
      } else merged++;
    } catch (e) {
      invalid.push({ row: i + 2, error: e instanceof Error ? e.message : "Chyba" });
    }
  }
  return { created, merged, invalid, leadIds };
}
