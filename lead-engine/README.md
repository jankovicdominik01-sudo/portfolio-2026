# DJWeby Lead Engine

Interný obchodný systém: **RESEARCH → CALL → HANDOFF → DEAL**.

Ranná rutina nájde a overí firmy → volajúci (Soňa) zavolá a získa súhlas s kontaktom (nie predaj) → Dominik zavolá, zistí záujem, predá, eviduje platbu →
Dominik dostane kvalifikovaný lead aj s tým, čo firma povedala, a s odporúčaným začiatkom hovoru.

Samostatná Next.js appka v priečinku `lead-engine/` — **nie je súčasťou webu djweby.sk**.
Nasadzuje sa ako vlastný Vercel projekt s **Root Directory `lead-engine`**. Appka beží na ceste
`/leady` (koreň `/` presmeruje na `/leady`).

## Stack

Rovnaký ako djweby.sk: Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, framer-motion,
lucide-react, Inter, tmavé `#050505` + oranžový akcent. Navyše: zod (validácia), Anthropic SDK
(AI analýza), Supabase / Vercel Blob (úložisko).

## Architektúra

```
app/leady/               routy (/leady)
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
lib/
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
| `calls`         | každý telefonát (volajúci aj Dominik), oddelený od leadu |
| `commissions`   | odmeny volajúcich: pending → confirmed → paid (suma iba z nastavenia) |
| `settings`      | pravidlo odmeny a obsah balíka za cenu ponuky (prázdne = NEEDS CONFIGURATION) |
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

### Lead Radar (3.0) — ranná rutina

`routine/radar_run.py` + balík `routine/radar/`. Z malého množstva údajov poskladá **overenú business entitu**:

```
DISCOVERY (katalógy SK/CZ, registre RPO/ARES, výsledky vyhľadávania: web / Instagram / Facebook)
→ ENTITY RESOLUTION (IČO, telefón, e-mail, doména, odkaz web↔social; negatívne signály: iné IČO, iná krajina)
→ WEBSITE HUNTING (katalóg, e-mail, bio, vyhľadávanie telefónu/názvu) → FINGERPRINT → OWNERSHIP
→ KLASIFIKÁCIA + POPIS (iba z evidencie) → COMMERCIAL SIGNALS → GOLD/SILVER/RESEARCH → ROUTING Soňa/Jozo
```

- „Web sme nenašli“ ≠ „nemá web“: stav webu je `confirmed / probable / no_website_found / uncertain`.
- Instagram/Facebook/Google/Seznam sa **priamo nesťahujú** (login wall, 429, robots/podmienky). Profily sa hľadajú
  cez výsledky vyhľadávania — v rutine nástrojom WebSearch (kolá: skript → `search_requests.json` → agent →
  `search_results.json` → skript), voliteľne Brave / Google CSE / Places API (env kľúče).
- Každý údaj má pôvod a čerstvosť (Fact: value, confidence, sources, verified_at), celý postup je v TRACE LEAD.
- Testy: `python3 -m unittest discover -s routine -p "test_*.py"` (vrátane spec fixtures A–E, identity, klasifikácie).
- Golden set (ručne overené reálne firmy) je v súkromnom úložisku (`/leady/api/v1/golden`), meranie presnosti:
  `routine/radar_golden.py`.

### Ranná rutina (1.0)

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
cd lead-engine
npm install
npm run dev          # http://localhost:3000/leady · dominik/dominik, sona/sona (jozo = neaktívny, história)
npm test             # TS logika (node:test) + Python regresné testy zberného skriptu
```

## Nasadenie (Vercel)

1. Vercel → Add New → Project → import `portfolio-2026`, **Root Directory: `lead-engine`**.
2. Storage → Create → Blob (Private) → Connect → Redeploy (trvalé dáta).
   Bez toho beží v testovacom režime s upozornením.
3. Settings → Domains: vlastná doména (napr. `leady.djweby.sk`, DNS CNAME na Vercel).

Podpisový kľúč session vzniká pri builde (`next.config.ts`), v repozitári nie je. Účty bez `LE_USERS`
sú predvolené `dominik` (admin), `sona` (aktívna volajúca) a `jozo` (neaktívny — história ostáva) — v kóde sú iba scrypt hashe. Nový volajúci = nový riadok v `LE_USERS`, bez zmeny kódu.
Voliteľné env: `LE_USERS`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `AI_MODEL`, `LE_API_KEY`,
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (pozri `.env.example`).
