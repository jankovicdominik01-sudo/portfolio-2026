import "server-only";
import { db } from "./db";
import { importRows } from "./import";
import { analyzeLead } from "./leads";
import { normalizeCategory, type SessionUser } from "./types";

/**
 * Ranná rutina: SOURCE → DISCOVERY → VALIDATION → WEB CHECK → ANALYSIS → CALL BRIEF → DATABASE → NOTIFY.
 *
 * Discovery (hľadanie firiem) je zámerne mimo tejto appky — robí ho konektor
 * alebo AI agent, ktorý dostane zadanie („záhradníctva v okolí Skalice“) a pošle
 * kandidátov sem. Všetko ostatné (filter, duplicity, overenie, analýza, brief,
 * notifikácia) beží tu, rovnako ako pri ručnom pridaní.
 */

export interface SourceConnector {
  id: string;
  /** Vráti kandidátov vo formáte LeadInput (name, city, phone, website, category…). */
  discover(query: string): Promise<Record<string, unknown>[]>;
}

/** Sem sa neskôr zaregistrujú konektory (katalógy, Google Places, …). */
export const CONNECTORS: SourceConnector[] = [];

export async function runMorningRoutine(
  user: SessionUser,
  input: { query?: string; candidates: Record<string, unknown>[] },
) {
  const started = new Date().toISOString();
  const report: { step: string; detail: string }[] = [];

  // 1–2. SOURCE + DISCOVERY
  const discovered = [...input.candidates];
  if (input.query) {
    for (const c of CONNECTORS) {
      try {
        const found = await c.discover(input.query);
        discovered.push(...found);
        report.push({ step: "discovery", detail: `${c.id}: ${found.length} kandidátov` });
      } catch (e) {
        report.push({ step: "discovery", detail: `${c.id}: chyba ${e instanceof Error ? e.message : ""}` });
      }
    }
  }
  report.push({ step: "source", detail: `${discovered.length} kandidátov spolu` });

  // 3. FILTER — iba náš segment a aspoň jeden reálny kontakt
  const suitable = discovered.filter((c) => {
    const cat = normalizeCategory(String(c.category ?? c.name ?? ""));
    const hasContact = !!(c.phone || c.website || c.email);
    return hasContact && (cat !== "ine" || c.category === "ine");
  });
  report.push({ step: "filter", detail: `${suitable.length} vhodných (${discovered.length - suitable.length} vyradených)` });

  // 4. DUPLICITY + VALIDÁCIA
  const res = await importRows(user, suitable, "routine");
  report.push({
    step: "dedupe",
    detail: `${res.created} nových, ${res.merged} už existovalo (zlúčené), ${res.invalid.length} neplatných`,
  });

  // 5–9. WEB CHECK → ANALÝZA → HOOK → CALL BRIEF → ULOŽENIE
  let ready = 0;
  let nothing = 0;
  for (const id of res.leadIds.slice(0, 15)) {
    try {
      const r = await analyzeLead(user, id);
      if (r.ready) ready++;
      if (r.nothingFound) nothing++;
    } catch {
      /* ďalší */
    }
  }
  report.push({ step: "analysis", detail: `${ready} pripravených na telefonát, ${nothing} bez výrazného dôvodu` });

  // 10. NOTIFIKÁCIA
  if (res.created > 0) {
    await (await db()).insertNotification({
      id: `nt_${crypto.randomUUID().slice(0, 12)}`,
      at: new Date().toISOString(),
      lead_id: null,
      kind: "new_leads",
      title: `Dnes pribudlo ${res.created} nových leadov`,
      body: `${ready} je pripravených na telefonát${input.query ? ` · „${input.query}“` : ""}.`,
      read: false,
    });
  }

  return { started, finished: new Date().toISOString(), created: res.created, ready, report, invalid: res.invalid };
}
