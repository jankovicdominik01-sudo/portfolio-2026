# DJWeby Lead Engine

Interný obchodný systém: **RESEARCH → CALL → HANDOFF → DEAL**.

Ranná rutina nájde a overí firmy → Opportunity Engine rozhodne CALL / ASYNC / HOLD → operátor (dnes Roman) zavolá a získa
súhlas, aby sa ozval Dominik (nie predaj) → 🔥 Ready for Dominik → Dominik zavolá, zistí záujem, predá, eviduje platbu →
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
→ KLASIFIKÁCIA + POPIS (iba z evidencie) → COMMERCIAL SIGNALS → GOLD/SILVER/RESEARCH → PROCESS SIGNALS + TAGY → OPPORTUNITY → KANÁL (CALL / ASYNC / HOLD) → AKTÍVNY OPERÁTOR
```

- „Web sme nenašli“ ≠ „nemá web“: stav webu je `confirmed / probable / no_website_found / uncertain`.
- Instagram/Facebook/Google/Seznam sa **priamo nesťahujú** (login wall, 429, robots/podmienky). Profily sa hľadajú
  cez výsledky vyhľadávania — v rutine nástrojom WebSearch (kolá: skript → `search_requests.json` → agent →
  `search_results.json` → skript), voliteľne Brave / Google CSE / Places API (env kľúče).
- Každý údaj má pôvod a čerstvosť (Fact: value, confidence, sources, verified_at), celý postup je v TRACE LEAD.
- Testy: `python3 -m unittest discover -s routine -p "test_*.py"` (vrátane spec fixtures A–E, identity, klasifikácie).
- Golden set (ručne overené reálne firmy) je v súkromnom úložisku (`/leady/api/v1/golden`), meranie presnosti:
  `routine/radar_golden.py`.

### Opportunity Engine v2 (Phase 2)

Otázka: *čo táto firma robí ručne, čo jej web alebo jednoduchý systém vie zobrať z rúk?*

```
COMPANY → EVIDENCE → PROCESS RECONSTRUCTION → BUSINESS PAIN → OPPORTUNITY → RECOMMENDED SYSTEM
        → MONEY LEAK (minúty, nie eurá) → DEMO PREVIEW → ROMAN (Call Card v3)
```

| Modul | Čo robí |
|---|---|
| `routine/radar/signals.py` | 16 procesných signálov z webu (`code, level, evidence, source, observed_at, confidence`), neprítomnosť = „nenašli sme“ |
| `lib/process.ts` | normalizácia signálov (aj staré kľúče), evidence s id, business painy, rekonštrukcia procesu (krok iba z evidence) |
| `lib/segments.ts` | segment templates AUTO_SERVICE, FLOORING_TRADES, BARBER_BEAUTY, GENERAL_TRADES: jeden zdroj pre engine, demo, neskôr djweby.sk simulátor a dj-core |
| `lib/opportunity.ts` | 7 dimenzií (HIGH/MEDIUM/LOW/UNKNOWN + dôvod + evidence_ids), odporúčaný systém z painov, WHY THIS LEAD, verzie pravidiel, stav, run log |
| `lib/money-leak.ts` | čas na dopyt iba s predpokladmi, dopyty / týždeň UNKNOWN, eurá iba s hodinovou sadzbou od používateľa |
| `lib/call-card.ts` | Call Card v3: prečo, max. 3 fakty, nápad na systém, 1 veta, 2 až 3 otázky, ďalší krok, predpoklady na potvrdenie |
| `lib/demo-templates.ts` | demo v2 (zákazník + dashboard), personalizácia iba z evidence, verejná projekcia, `expires_at`, vypnutie |

- Stav analýzy: `NOT_ANALYZED → (ANALYZING) → READY | FAILED`. Výpočet je čistá funkcia nad uloženým profilom.
  Čítanie webu beží v rannej rutine (`radar_run.py --recheck`), nie v requeste. „Obohatiť z webu“ nastaví ANALYZING
  a `needs_reverify`, recheck pošle nový profil a výsledok je READY.
- Verzie pravidiel sú pri každom výsledku (`versions`): engine 2.0, segment templates 1.0, money leak 1.0, signály 1.0.
- `opportunity_feedback` (CONFIRM / REJECT / UNKNOWN od operátora) je dátový kontrakt pre Phase 3 learning loop.
- Do Romanovej fronty ide lead iba s overenou identitou, aktivitou, telefónom, ručným procesom alebo overenou medzerou
  webu, WHY THIS LEAD z evidence a odporúčaným systémom. Telefón a starý web samy nestačia.
- Demo: iba tlačidlom Dominika, interný náhľad `/leady/demo/<kód>` (noindex, iba admin). Nič sa neodosiela.
- Testy: `tests/phase2.test.ts`, `tests/golden-opportunity.test.ts` (10 typov firiem), Panenka z reálnej evidence
  v `tests/fixtures/panenka.json`.

### Kapacita fronty operátora

Ranná rutina nepridáva slepo ďalších 20. `GET /leady/api/v1/routines/morning` vráti pre každého operátora
`active` (nevybavené: na volanie + opakovaný pokus + callback), `target` (`queue_target` v `LE_OPERATORS`,
predvolene 20) a `need = max(0, target − active)`. Nerátajú sa Dominik follow-up a ďalej, lost, nevolať,
vyradené ani ASYNC. Prompt rutiny: `routine/ROUTINE_PROMPT.md`.

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
npm run dev          # http://localhost:3000/leady · DEV účty dev-admin/dev-admin, roman/dev-roman (iba lokálne)
npm test             # TS logika (node:test) + Python regresné testy zberného skriptu
```

## Nasadenie (Vercel)

1. Vercel → Add New → Project → import `portfolio-2026`, **Root Directory: `lead-engine`**.
2. Storage → Create → Blob (Private) → Connect → Redeploy (trvalé dáta).
   Bez toho beží v testovacom režime s upozornením.
3. Settings → Domains: vlastná doména (napr. `leady.djweby.sk`, DNS CNAME na Vercel).

Podpisový kľúč session vzniká pri builde (`next.config.ts`), v repozitári nie je. Produkčné účty a ich hashe sú
**iba** vo Vercel env `LE_USERS`, v kóde nie je žiadny. Produkcia je fail-safe: bez `LE_USERS`, s heslom v čistom texte
alebo bez aktívneho admina sa neprihlási nikto.

### Operátori (volajúci)

Operátor = účet v `LE_USERS` s rolou `caller` **a** záznam v `LE_OPERATORS` (predvolene iba Roman, ACTIVE, CALL).
Účet s rolou caller bez záznamu operátora sa neprihlási a nedostane lead. Nový operátor = nový riadok v oboch env,
bez zmeny kódu. Do záznamu operátora patria iba pracovné údaje.

```bash
npm run hash-password   # vypíše scrypt$… hash, heslo sa nikde neukladá
```

```
LE_USERS=dominik|Dominik Jankovič|admin|<hash Dominika>;roman|Roman|caller|<hash Romana>|m
LE_OPERATORS=[{"operator_id":"roman","name":"Roman","status":"ACTIVE","channels":["CALL"],"phone_number":null,"queue_target":20}]
```

`LE_OPERATORS` je voliteľné, kým je Roman jediný operátor (je predvolený).

### Migrácia histórie (jednorazovo po nasadení)

Pôvodní volajúci sa z histórie nahradia neutrálnym „pôvodný operátor“, prvý reálny prípad (Panenka) sa pripíše
Romanovi. Nič sa nemaže, beh je idempotentný. Najprv na sucho, potom `apply`:

```bash
curl -X POST https://<lead-engine>/leady/api/v1/admin/retire-legacy-callers -H "Authorization: Bearer $LE_API_KEY" -d '{}'
curl -X POST https://<lead-engine>/leady/api/v1/admin/retire-legacy-callers -H "Authorization: Bearer $LE_API_KEY" \
  -H "Content-Type: application/json" -d '{"apply":true,"reassign_unworked_to":"roman"}'
```
Voliteľné env: `LE_USERS`, `LE_OPERATORS`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `AI_MODEL`, `LE_API_KEY`,
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (pozri `.env.example`).
