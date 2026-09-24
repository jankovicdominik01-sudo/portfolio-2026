# DJWeby Lead Engine

Interný obchodný systém: **RESEARCH → CALL → HANDOFF → DEAL**.

AI robí research a pripraví call brief → kamarát zavolá a zistí, či môže Dominik zavolať →
Dominik dostane kvalifikovaný lead aj s tým, čo firma povedala, a s odporúčaným začiatkom hovoru.

Beží na **djweby.sk/leady** v rámci projektu portfolio-2026, ale je izolovaný: vlastný layout a štýly
(`app/leady/`), vlastná logika (`lead-engine/`), `proxy.ts` chráni iba `/leady/*`. Verejný web sa nemení
(okrem toho, že vlastný kurzor sa na `/leady` nezobrazuje).

## Stack

Rovnaký ako djweby.sk: Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, framer-motion,
lucide-react, Inter, tmavé `#050505` + oranžový akcent. Navyše: zod (validácia), Anthropic SDK
(AI analýza), Supabase / Vercel Blob (úložisko).

## Architektúra

```
app/leady/               routy pod djweby.sk/leady
  layout.tsx, leady.css  vlastný vzhľad (scoped na .leady-root), noindex
  login/                 prihlásenie
  (app)/                 chránené stránky (proxy.ts + requireUser na serveri)
    page.tsx             Dnes — action-first dashboard (admin) / „Dnes voláš“ (caller)
    leads/               zoznam + filtre (stav, segment)
    leads/[id]/          detail leadu (admin) / call brief (caller)
    leads/[id]/call/     režim hovoru → výsledok → handoff
    pipeline/  inbox/  add/  settings/
  actions.ts             server actions (každá overuje rolu + validuje zod-om)
  api/v1/                API pre automatizáciu (Bearer LE_API_KEY)
lead-engine/lib/
  types.ts               doménový model (Company, Lead, CallLog, LeadEvent, Offer, Notification)
  leads.ts               use-cases: create/merge, analyze, logCallerCall, handoff, pipeline
  scoring.ts             trust (🟢🟡🔴), priorita (HOT/READY/CHECK/LOW), deduplikačné kľúče
  import.ts              CSV/JSON parser + hromadný ingest
  routine.ts             ranná rutina (pipeline + SourceConnector rozhranie)
  ai/web.ts              web analysis service — stiahne web, vytiahne fakty (SSRF ochrana)
  ai/signals.ts          fakty → evidence (E1…En) + signály
  ai/rules.ts            analyzátor bez AI (iba podložené tvrdenia, vie povedať „nič“)
  ai/claude.ts           AI analýza (structured output, musí citovať evidence)
  ai/analyze.ts          orchestrácia + kontrola zdrojov a zakázaných fráz
  ai/brief.ts            ponuka (iba z DB), námietky, Dominikov úvod hovoru
  db/                    Repository rozhranie + Supabase / Vercel Blob / lokálny súbor
supabase/migrations/     SQL schéma
```

### Databázové entity

| Entita          | Účel |
| --------------- | ---- |
| `companies`     | identita firmy + kontakt, `dedupe_keys` (email → telefón → doména → názov+mesto) |
| `leads`         | obchodný prípad: status, priority, trust, `analysis`, `call_brief`, `qualification`, `next_action` |
| `calls`         | každý telefonát (kamarát aj Dominik), oddelený od leadu |
| `lead_events`   | timeline (vytvorenie, merge, analýza, hovor, handoff…) |
| `offers`        | `existing_offer` — reálne rozpracované weby; `available=false` → argument sa nezobrazí |
| `notifications` | inbox („🔥 Nový kvalifikovaný lead“, „Dnes pribudlo 7 leadov“) |

### API

| Metóda | Endpoint | |
| ------ | -------- | - |
| POST | `/leady/api/v1/routines/morning` | `{ query?, candidates[] }` → filter → duplicity → analýza → notifikácia |
| POST | `/leady/api/v1/leads` | `{ leads[], analyze?, source? }` — lead ingestion |
| GET  | `/leady/api/v1/leads?status=` | zoznam |
| GET  | `/leady/api/v1/leads/:id` | detail s hovormi a históriou |
| POST | `/leady/api/v1/leads/:id/analyze` | (znova) spustiť analýzu |
| GET  | `/leady/api/v1/health` | úložisko + AI engine |

Autorizácia: session cookie alebo `Authorization: Bearer $LE_API_KEY`.

### Ranná rutina

`runMorningRoutine` (lib/routine.ts) je hotová pipeline — chýba jej iba zdroj firiem.
Discovery (hľadanie firiem podľa zadania „záhradníctva v okolí Skalice“) sa pripojí buď ako
`SourceConnector` (katalóg, Google Places…), alebo ho robí externý AI agent, ktorý kandidátov
pošle v `candidates`. Scheduler (Vercel Cron / Claude routine / n8n) iba zavolá endpoint o 7:00.

### AI

Bez `ANTHROPIC_API_KEY` beží pravidlový analyzátor (rýchly, deterministický). S kľúčom
analyzuje Claude (`AI_MODEL`, default `claude-opus-5`) nad tými istými overenými faktami —
tvrdenia bez platného evidence id sa zahodia, ponuka a cena sa berú výhradne z tabuľky `offers`.

## Lokálne

```bash
npm install
npm run dev          # http://localhost:3000/leady · dominik/dominik, jozo/jozo
```

## Nasadenie (Vercel, projekt portfolio-2026)

Jediný povinný krok: **Storage → Create → Blob (Private) → Connect to portfolio-2026 → Redeploy**.
Vercel pridá `BLOB_READ_WRITE_TOKEN` — z neho sa odvodí aj podpisový kľúč session, takže netreba
nastavovať nič ďalšie. Kým úložisko nie je pripojené, `/leady/login` ukazuje túto inštrukciu.

Účty: bez `LE_USERS` platia predvolené účty `dominik` (admin) a `jozo` (volajúci) — v kóde sú iba
scrypt hashe, heslá má Dominik. Voliteľné env: `LE_USERS`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`,
`AI_MODEL`, `LE_API_KEY`, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (pozri `.env.example`).
Supabase má prednosť pred Blob úložiskom; schéma je v `supabase/migrations/0001_lead_engine.sql`.
