# Back to Soil? — audit a plán druhej verzie (4. 10. 2026)

Projekt: Erasmus+ *Young Ambassadors of Ecological Agriculture*, Mezitli / Mersin, 8.–14. 10. 2026.
Kód: `portfolio-2026`, vetva `claude/focused-einstein-qgzmx8` (PR #8), priečinok `erasmus-site/`.
Prezentácia sa v programe hodí do slotov *Presentation of Group Work*. Infopack žiada: udržateľné postupy a environmentálne problémy v našom regióne + dobré a zlé príklady nakladania s poľnohospodárskym odpadom. Účastníci majú angličtinu na úrovni B1, preto držíme text jednoduchý.

---

## 1. Audit súčasnej verzie

**Čo je dobré a ostáva**
- Engine: pevné plátno 1920×1080, kroky cez GSAP timeline, spätný chod, menu, poznámky, lightbox, hash odkazy, offline build (fonty, JS aj CSS sú v jednom HTML, fotky vedľa).
- Disciplína zdrojov: `sources.js` s úrovňami A–E a poliami „na čo to používame / čo netvrdíme“.
- Vizuál: tmavý dokumentárny „field notebook“, Fraunces + IBM Plex, zrno.
- Silné scény: pôda (canvas), slučka, ktorá sa zmenší do rohu, satelitná mapa s pinmi, 12 ha v mierke, simulácia monokultúra/mozaika, 100 jarabíc, Dubina s posuvníkom, ekosystém EkoFarmy, split screen sucha, morph jedlo → odpad, 3D fermentor, mapa Horného Jatova.

**Čo je slabé**
- Kompostáreň je jedna preplnená scéna (19 z 21) s prázdnymi rámčekmi. Prišla až za bioplynom.
- Odpad ilustrujú cudzie fotky z Wikimedia, napr. „garden waste – not from Senica“. Teraz máme vlastné.
- Poznámky majú 1–2 vety. Nemajú rozdelenie rečníkov a „presenter view“ nie je. Poznámky (N) sa zobrazujú priamo na projektore.
- Navigácia: zámok 450 ms zahadzuje rýchle stlačenia. Nefunguje koliesko ani touchpad. Podržaný kláves preskakuje scény. Pri rýchlom návrate do scény sa canvas zastaví (chyba `setTimeout(stop, 800)`).
- Čitateľnosť: podnadpis v scéne 1 leží cez korene, slabý kontrast.
- Generické scény bez lokálneho dôkazu medzi silnými lokálnymi: vertikálne farmy, Skalica (stavebný odpad), spaľovňa Slovnaftu.

**Rozhodnutie:** engine a vizuálny systém vylepšiť, nie zahodiť. Príbeh a scény od kapitoly „farmy“ ďalej postaviť nanovo okolo terénneho výskumu.

---

## 2. Nové dôkazy

### A. Kompostáreň TS Senica — exkurzia 30. 9. 2026, 9:00
- **15 fotiek + 16 krátkych klipov.** Fotil pán učiteľ Martin Woznica, do skupiny Turecko ich poslal 30. 9. o 12:25. Ide o kompresiu z WhatsAppu (1600 px).
- **Jedno 15 s video:** panoráma areálu (pohľad do miešača → kopa potravín v igelitoch → kontajnery → nakladač Kramer). Bez reči.
- **E-mail 23. 9.** (Ing. Marian Fojtlín, vedúci divízie komunálnych prác): kódy odpadov, množstvá 2025, kapacita, celý technologický postup, problémy s prímesami.
- **E-mail 1. 10.:** v prílohe *„schéma materiálového toku“* (`.pub`) a *„staršia ilustračná schéma“* (`.doc`). **Prílohy sa mi nepodarilo stiahnuť**, Gmail konektor nevie sťahovať súbory. Ak ich uložíš do `erasmus-site/assets/agriculture/operator/`, presne podľa nich prekreslím mapu toku.

**Inventár fotiek a stav každého tvrdenia**

Legenda: ● potvrdené prevádzkovateľom · ○ vidno na našej fotke · ◌ naša interpretácia · ? nevieme.

| Fotka | Čo je na nej | Stav |
|---|---|---|
| 005 | Ťahaný **prekopávač hrobieľ**: rotor s lopatkami, kardan (vývodový hriadeľ), oblúkový rám; na betóne rozsypaný kompost s modrým kúskom plastu | prevzdušňovanie obracačom ● · rotor ○ · kardan → ťahá traktor ◌ · plast ○ |
| 006 | **Dozrievajúce hroble**, v pozadí červený nakladač pri práci, na okraji kopy drobné farebné kúsky plastu | hroble ● · plastové úlomky ○ |
| 007 | **Kopa potravín (ovocie, zelenina), veľa z nich v igelitových taškách**; okolo kaluž tekutiny; za ňou obrovská kopa zelene; študenti so sprievodcom | plasty ako hlavný problém ● · igelity ○ · tekutina ○ · kam odteká ? · pôvod odpadu ? |
| 008 + video | Pohľad do **červeného stroja**: tmavá, podrvená, premiešaná hmota | miešanie ● · hmota ○ |
| 009 / 010 / 021 | Červený stroj s násypkou, rebríkom a plošinou; nápis **SAMURAI 600** | rezacie a zmiešavacie zariadenie existuje ● · že je to práve tento stroj ◌ (vysoká istota) |
| 011 / 013 / 019 | Obrovská **kopa konárov** na betóne, prívesy, modré kontajnery pod strechou | drevnatý odpad sa štiepkuje ● · kopa ○ |
| 015 / 018 | Modrý stroj **Husmann** („Zerkleinerungs-/Kompostier…“) s tabuľkou EÚ projektu *kompostáreň*; za ním hora zeleného odpadu | drvič ◌ · presná úloha (kuchynský odpad? drevo?) ? |
| 014 / video | Modré kontajnery pod strechou, červený uzavretý kontajner, hala, nakladač **Kramer** | fermentor EWA? ? · hygienizačný kontajner CSC? ? |
| 002 / 004 | Naši štyria pred budovou **Poľnohospodárske družstvo SENICA** | ○ |

**Čo na fotkách nemáme:** váhu a príjem, sito (preosievanie), hotový preosiaty kompost, teplomer, jednoznačne fermentor EWA ani hygienizačný kontajner. V prezentácii tieto kroky označíme „bez fotky – podľa opisu prevádzkovateľa“.

### B. Poľnohospodárske družstvo Senica (návšteva 30. 9., neplánovaná)
- Nápis na budove je **„Poľnohospodárske družstvo SENICA“**, nie „RD“. V prezentácii píšem *farming cooperative in Senica*.
- **55 fotiek od družstva** (pán učiteľ ich preposlal 2. 10.). Majú vysoké rozlíšenie a slovenské popisky:
  - „Cirok zožratý danielami“
  - „Repka po jeleňoch“ (2×)
  - „V pozadí je repka rozkvitnutá, v popredí je obžratá, táto plocha sa iba mulčovala. Danielom chutia aj kvety“
  - „Kukurica po diviakoch“
  - „Cirok po jeleňoch v čase zberu“ (z kabíny kombajnu)
  - plus pekné zábery krajiny pri Senici
- Z tvojho zadania: **počasiu sa vedia prispôsobiť** (napr. skoršou sejbou). **Veľký problém je zver.** Žiadne čísla. V prezentácii to bude len „at the cooperative we were told…“ [OUR FIELD VISIT].
- Fotky slnečníc bez popisky nepripisujem žiadnemu zvieraťu.

### C. Ďalšie
- **EkoFarma No. 5:** e-mail Jozefa Vinceho (22. 9.). Povolenie na fotky z FB pri uvedení zdroja. Fotky z FB zatiaľ v projekte nie sú.
- **Statok Dubina:** p. Števo 28. 9. ponúkol hlasovku na WhatsApp. V synchronizovanom WhatsAppe nie je. Ostávame pri zdrojoch BROZ / Krajina živá.
- **WhatsApp Turecko:** pán učiteľ poslal článok o úniku hnojiva z bioplynky do Hrona. Overil som to cez TASR: **júl 2021, Budča**. Búrka zvalila strom na vak s digestátom, asi **400 m³** uniklo do potoka a Hrona a ryby uhynuli. Na stránku Aktualít sa nedostanem, preto citujem TASR.
- **Program výmeny a infopack** (WhatsApp Erasmus Türkiye, Downloads).

---

## 3. Fact-check a neistoty

| Tvrdenie | Stav |
|---|---|
| 12 ha vs EÚ 3,9 ha; Trnavský kraj 18,2 ha | ✔ Overené v PDF IEP 2020 (satelit OneSoil). Je to **historický údaj**, nie meranie 2026. |
| 46 % pôdy v poliach nad 30 ha | ✔ IEP, ale **vypúšťam**. Menej čísel. |
| Jarabice −99 % za 50 rokov | ✔ SME 2025 podľa SOS/BirdLife (overila predchádzajúca session). Nechávam s atribúciou. |
| One Earth 2022 | ✔ „up to 2× IEA“ a „62 % únikov z malého počtu super-emitentov“ (Imperial). ✘ „5 % emitentov“ a „digestát = najväčší zdroj“ som teraz nevedel overiť, **vypúšťam**. |
| EÚ limit 3 g/kg plastov v komposte | ✘ **Vypúšťam.** Od júla 2026 sa mohol sprísniť a nevedel som to overiť. |
| Horné Jatovo: do 12 % nepatričných vecí, plyn pod 40 % CH₄ cez biofilter, „asi 20 %“ | ✔ CTZN / Denník N 7/2024. Stav v roku 2026 nevieme, v prezentácii vždy s dátumom. |
| Senica: 2 685 t + 642 t = 3 327 t (2025), kapacita 4 200 t, 650–800 t kompostu za rok, 45–70 °C, ≥70 °C ≥1 h, 2 : 1, 3–5 mesiacov | ✔ E-mail prevádzkovateľa. |
| Rozdiel 3 327 t → 650–800 t | ? Prevádzkovateľ ho nevysvetlil. „Väčšinou voda a CO₂ + vytriedené prímesi“ je **naša interpretácia ◌**. Lepšie je potvrdiť e-mailom. |
| Kto bol sprievodca v modrej bunde | ? Nemenujem. |
| Popisky na fotkách z družstva napísalo družstvo | ◌ Pravdepodobne áno (preposlal pán učiteľ). **Prosím potvrď.** |
| Skorá sejba ako adaptácia | [OUR FIELD VISIT], len z tvojho podania. Žiadne konkrétne plodiny ani dátumy. |

---

## 4. Nový príbeh

Terénny výskum je jadro. Kompostovanie je hlavná kapitola. Bioplyn je stručný a vyvážený.

**Studený úvod:** naša fotka potravín v igelitoch → „Can this go back to soil?“
**Systém** → **krajina** → **dve farmy** (čo funguje a kde to aj tak zlyhá) → **naša neplánovaná návšteva družstva** (adaptácia je často jednoduchá, zver je ťažšia) → **jedlo sa stáva odpadom** → **terénna správa: kompostáreň Senica** (cesta jedného nákladu cez 3 scény + čo tam nepatrí) → **správny materiál pre správny proces** → **bioplyn** → **obnoviteľné ≠ bez dopadu** → **čo môže zlyhať a ako vyzerá dobré riadenie** → **späť do pôdy**.

Záver: **„Sustainability is not a product. It is the quality of the whole system.“**

---

## 5. Plán scén (22 hlavných + 2 záložné)

Časy sú pre hovorené slovo. Spolu ≈ 19–21 min. Rečníci: **Dominik 6, Adam 6, Sara 5, Karolína 5.**

| # | Nadpis (EN) | Kto | Obtiažnosť | Hlavná myšlienka | Dôkaz | Vizuál / animácia |
|---|---|---|---|---|---|---|
| 1 | **Can this go back to soil?** | Sara | Easy | Otvárame vlastnou fotkou z terénu | Naša fotka 007 | Studený úvod na fotke → rozpad do satelitu → pôda (canvas), titul „Back to Soil?“ |
| 2 | **One loop, not one technology** | Karolína | Easy | Udržateľnosť je systém | — | Kruh sa nakreslí, uzly dostanú „field visit“ odznaky, kruh sa zmenší do rohu |
| 3 | **Our region — and where we went** | Sara | Easy | Všetko do 75 km od školy; dve miesta sme navštívili osobne | EOX, zdroje | Oblúk Senica → Mersin (1 923 km) → satelit, piny s typom dôkazu |
| 4 | **When the landscape becomes too simple** | Adam | Advanced | 12 ha polia: erózia, voda, chýbajúci úkryt | IEP 2020 | Satelit → zoom → štvorce v mierke → bočná simulácia monokultúra/mozaika |
| 5 | **The partridge test** | Karolína | Easy | Mozaika krajiny = život | SME/BirdLife | 100 vtákov → 1 |
| 6 | **Statok Dubina: soil can recover** | Dominik | Advanced | Obnova trvá roky | BROZ | Panoráma premeny (5 krokov) + citát farmára |
| 7 | **Diversity instead of aggressive chemistry** | Adam | Medium | Prvý „postrek“ je živý plot | Náš e-mail | E-mail sa píše → ekosystém (vošky, predátori) → rebrík ochrany |
| 8 | **When drought still wins** | Karolína | Medium | Udržateľné ≠ nezraniteľné | Náš e-mail | Split screen, citát o strate, citát o ekonomike |
| 9 | **The visit we didn't plan** | Sara | Easy | Čakali sme reč o počasí | Naša fotka 002 | Naša fotka pred družstvom, otázka |
| 10 | **Adaptation is not always high-tech** | Sara | Easy | Niekedy stačí zmeniť, *kedy* sadíš | OUR FIELD VISIT | Krajina od družstva, okno sejby sa posunie skôr |
| 11 | **Wildlife is harder to control** | Dominik | Advanced | Poľnohospodárstvo potrebuje biodiverzitu a zároveň znáša tlak zveri | Fotky + popisky družstva | Anotovaná repka (kvitne / obžratá), stena dôkazov, sieť napätí |
| 12 | **Then food becomes waste** | Karolína | Easy | Bioodpad z mesta | E-mail TS, EÚ | Morph paradajka → tanier → zvyšky → hnedý kôš → nákladiak do Senice, čísla 2025 |
| 13 | **Field report: Senica composting plant** | Sara | Easy | Boli sme tam | Naše fotky | Pečiatka, kontaktné hárky „field notebook“, legenda stavov ●○◌? |
| 14 | **Follow one load (1): arrive, sort, prepare** | Adam | Advanced | Príjem, kopy, rezanie a miešanie | E-mail + fotky 011, 018, 009, 008, 015 | Mapa toku → kamera letí do fotiek, anotácie, lupa |
| 15 | **Follow one load (2): heat, air, time** | Dominik | Advanced | Kompost je riadený proces | E-mail + fotky 005, 006 + Vince | Teplomer 70 °C/1 h, hroble, obracač s anotáciami, krivka teploty, riadený vs. neriadený |
| 16 | **What should never go in** | Karolína | Medium | Plast sa nestane pôdou | Fotka 007, e-mail, CTZN | Lupy na igelity, štítky prímesí, reťaz následkov |
| 17 | **Follow one load (3): screen, check, return** | Adam | Medium | Preosievanie, kontrola, 650–800 t do záhrad; kam zmizla hmota | E-mail | Ilustrácia sita (bez fotky), bilancia hmoty s ◌ |
| 18 | **The right material for the right process** | Dominik | Advanced | Kompost vs. anaeróbna digescia nie sú rivali | SBA | Rozdelenie tokov |
| 19 | **How a biogas plant works** | Adam | Advanced | Teplý žalúdok bez kyslíka | Explainer | 3D rez fermentorom |
| 20 | **Renewable does not mean impact-free** | Dominik | Advanced | O výsledku rozhoduje prevádzka | CTZN, One Earth | Mapa Horného Jatova → únik → globálne zistenie |
| 21 | **What can fail — and what good management looks like** | Adam | Advanced | Každý krok slučky má slabé miesto | Všetko + TASR Hron | Slučka sa rozsvieti na miestach zlyhania; páry „zlyhá / dobre riadené“ |
| 22 | **Back to soil** | Dominik (+ všetci) | Advanced | Systém, nie produkt | — | Návrat pôdy z úvodu, 5 lekcií, záverečná veta, otázka pre Mersin |
| B1 | Backup: vertical farms | — | — | len na otázku | Nature Food | pôvodná scéna |
| B2 | Backup: when waste governance fails (Skalica) | — | — | len na otázku | Aktuality | pôvodná scéna |

Každá scéna má poznámky v štruktúre: **Presenter · čas · obtiažnosť · čo je na plátne · čo povedať (po krokoch) · na čo ukázať · prechodová veta.** Okrem toho vznikne tlačiteľný **scenár + mapa rečníkov** (`script.html`) a **presenter view** v druhom okne.

---

## 6. Čo vyhadzujem alebo prerábam

- **Von z hlavnej línie:** vertikálne farmy, Skalica, spaľovňa Slovnaftu. Idú do zálohy, lebo nie sú lokálne poľnohospodárske a stoja medzi silným terénom.
- **Cudzie fotky odpadu** (kitchen-waste, garden-waste) nahrádzajú naše fotky.
- **Spájam:** 12 ha + simulácia, Dubina + citát, EkoFarma + ekosystém.
- **Kompostáreň:** z 1 scény robím 5 (13–17) a presúvam ju pred bioplyn.
- **Čísla:** vypúšťam 46 %, 3 g/kg, „5 % emitentov“, 45 000 t, 9 000 t, 36 kontajnerov, >95 % CH₄.

## 7. Engine a spoľahlivosť (Turecko)

- Žiadne zahodené stlačenie: rozbehnutá animácia sa dokončí okamžite a pokračuje sa. Podržaný kláves nič nepreskočí.
- Koliesko a touchpad: jedno gesto = jeden krok, zotrvačnosť sa ignoruje.
- **Presenter view (P):** druhé okno s poznámkami, časovačom a nasledujúcou scénou. Funguje aj offline zo súboru.
- Ďalej: hash `#s7.2` (scéna aj krok) prežije refresh, B = čierna obrazovka, čísla + Enter = skok, prehľad scén (G), skrytie kurzora, prednačítanie fotiek (aktuálna ±2), opravený canvas pri rýchlom návrate.
- QA: Playwright Chromium + WebKit 1920×1080, rýchle prepínanie, spätný chod, refresh, wheel, fullscreen, offline (`file://`).

## 8. Čo potrebujem od teba (nič neblokuje)

1. Prílohy z e-mailu Ing. Fojtlína z 1. 10. (`.pub` a `.doc`) → `erasmus-site/assets/agriculture/operator/`.
2. Originály fotiek z kompostárne od p. Woznicu (ostrejšie než z WhatsAppu), prípadne jeho videá.
3. Potvrdiť: popisky fotiek z družstva sú od družstva? Kto nás sprevádzal v kompostárni (meno, funkcia)? Čo presne nám v družstve povedali (zvieratá, plodiny)?
4. Ak sa v kompostárni povedalo niečo konkrétne (napr. čo ich prekvapilo, čo pomáha), napíš mi to. Pôjde do poznámok ako [OUR FIELD VISIT].
