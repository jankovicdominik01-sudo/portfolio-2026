// Every claim on screen points to one of these. Our own field work ranks first.
// Levels:  A = our field visit / our photo   I = direct interview / operator data
//          B = official, institutional, peer-reviewed   C = journalism
//          D = industry view   E = explainer, blog, team note
export const LEVELS = {
  A: { name: "Our field research", short: "Our field visit", rule: "What we saw, photographed and were told on site. Highest value — and we say exactly what a photo can and cannot prove." },
  I: { name: "Direct interviews & operator data", short: "Interview / operator", rule: "Answers written to our team by the people who run the place. Their own description — not an independent audit." },
  B: { name: "Official, institutional and peer-reviewed", short: "Official", rule: "Government analysis, EU law, conservation programmes, peer-reviewed science. We still check the year and the place." },
  C: { name: "Journalism", short: "Journalism", rule: "Strong secondary sources. We keep the date: a 2024 report describes 2024, not today." },
  D: { name: "Industry view", short: "Industry view", rule: "Not neutral. Always said as „according to …“." },
  E: { name: "Explainers, blogs and team notes", short: "Explainer / blog", rule: "To explain how something works — never as the main proof of a disputed claim." }
};
export const LEVEL_ORDER = ["A", "I", "B", "C", "D", "E"];

export const SOURCES = {
  // ------------------------------------------------------------- A · our field research
  visitcompost: {
    pill: "Our field visit", level: "A",
    title: "Our visit to the Senica composting plant",
    author: "Dominik Jankovič, Adam Hájek, Sára Trajlinková, Karolína Rybáriková · teacher Martin Woznica",
    date: "30 September 2026, from 9:00",
    type: "Own field research: guided visit, photos, a short video, questions",
    context: "The visit was confirmed by Ing. Marian Fojtlín (Technické služby Senica). Photos and video were taken by our teacher and shared in our team chat the same day (15 photos, 16 short clips, one 15-second video). Our guide explained the site; we do not name him because we did not ask for permission.",
    use: "What we saw ourselves: machines, piles, the kitchen-waste pile with plastic bags, plastic pieces in the windrows.",
    avoid: "Machine models, capacities or anything the photo does not show. Where a function is our guess, the label says „our interpretation“.",
    url: ""
  },
  visitcoop: {
    pill: "Our field visit", level: "A",
    title: "Our visit to the farming cooperative in Senica (Poľnohospodárske družstvo Senica)",
    author: "Our team",
    date: "30 September 2026 (not planned in advance)",
    type: "Own field research: conversation on site",
    context: "What we were told: they can often adapt to the weather — for example by changing the sowing time, sowing earlier when needed. A big problem for them is wildlife eating and damaging crops. No numbers were given.",
    use: "The local trade-off between food production and wildlife; adaptation without high-tech.",
    avoid: "Any percentage of losses. Any claim about all Slovak farms. These are their words, paraphrased by us.",
    url: ""
  },
  // ------------------------------------------------------------- I · interviews and operator data
  tssenica: {
    pill: "Operator data", level: "I",
    title: "Answers about the Senica composting plant",
    author: "Ing. Marian Fojtlín, head of the municipal works division, Technické služby Senica a.s.",
    date: "23 September 2026 (email to our team)",
    type: "Direct email response — operator data",
    context: "Permitted waste codes; amounts processed in 2025 (2,685 t of biodegradable waste 20 02 01, 642 t of biodegradable kitchen and restaurant waste 20 01 08); capacity 4,200 t a year; the full process from reception to screening; temperatures; 650–800 t of compost a year; problems with unwanted items.",
    use: "Every number and process step about the plant.",
    avoid: "It is the operator's own description, not an independent audit. It does not explain the difference between input and output.",
    url: "https://www.tssenica.sk/"
  },
  coopphotos: {
    pill: "Cooperative's photo", level: "I",
    title: "Field photos and captions from the farming cooperative in Senica",
    author: "Poľnohospodárske družstvo Senica (shared with our team via our teacher)",
    date: "received 2 October 2026; photos from several seasons",
    type: "Material from the farm itself",
    context: "55 photos of damaged crops. Captions (translated): „Sorghum eaten by fallow deer“, „Rapeseed after red deer“, „In the background the rapeseed is in bloom, in the foreground it is grazed; this area was only mulched. Fallow deer like the flowers too“, „Maize after wild boar“, „Sorghum after red deer at harvest time“.",
    use: "Showing what wildlife damage looks like on their fields — in their own words.",
    avoid: "Photos without a caption are not linked to any animal. The photos show damage, not its size in money or percent.",
    url: ""
  },
  vince: {
    pill: "Our interview", level: "I",
    title: "Answers to our questions: Family EcoFarm No. 5",
    author: "Ing. Jozef Vince, MSc., Family EcoFarm No. 5 (near Galanta)",
    date: "22 September 2026 (email to our team)",
    type: "Direct email response to our student team",
    context: "Six questions, answered the same evening. Quotes are translated from Slovak; the original wording is kept in our research file. He allowed us to use photos from the farm's Facebook page if we name the source.",
    use: "Why they farm organically, pest protection, soil fertility, drought losses in 2026, farm waste, economics.",
    avoid: "It is one farmer's experience — no measured data, not a claim about all organic farms.",
    url: "https://www.ekofarma5.com/"
  },
  // ------------------------------------------------------------- B · official / institutional
  infopack: {
    pill: "Project brief", level: "B",
    title: "Infopack: Young Ambassadors of Ecological Agriculture (2025-1-TR01-KA152-YOU-00301481)",
    author: "Mezitli District Directorate of Agriculture and Forestry",
    date: "2026",
    type: "Project brief",
    context: "Youth exchange in Mezitli / Mersin, 8–14 Oct 2026. Task: sustainable agricultural practices and environmental issues in our region; good and bad practices of agricultural waste management in our community.",
    use: "Why this presentation exists.",
    avoid: "Not a source for environmental facts.",
    url: "https://www.instagram.com/mezitlitarimveorman/"
  },
  kzdubina: {
    pill: "Official · BROZ", level: "B",
    title: "Statok Dubina — Krajina živá profile and article „Statok Dubina sa stará o pôdu, ktorá to potrebuje“",
    author: "BROZ — Krajina živá programme (expert panel)",
    date: "27 June 2022",
    type: "Conservation NGO programme, farm award profile",
    context: "8 ha of arable land between Horné and Dolné Zelenice, 60 years of intensive farming; restored since 2012 with grass, a herd of horses, green manure, no-till vegetables and a food forest.",
    use: "Size, history, practices, the farmer's quote, the experts' observation.",
    avoid: "No number of horses; no measured soil data; „9 years“ was written in 2022.",
    url: "https://krajinaziva.sk/en/hospodari/statok-dubina/"
  },
  kzecofarm: {
    pill: "Official · BROZ", level: "B",
    title: "Rodinná EkoFarma No. 5 — Krajina živá profile",
    author: "BROZ — Krajina živá programme (expert panel)",
    date: "2022",
    type: "Conservation NGO programme, farm award profile",
    context: "A former vineyard unused for about 30 years; trees, shrubs and wild corners between the beds.",
    use: "Independent context next to the farmer's own answers.",
    avoid: "Relative dates in the text („four years ago“) are from 2022.",
    url: "https://krajinaziva.sk/hospodari/rodinna-ekofarma-no-5/"
  },
  ecofarmweb: {
    pill: "Farm website", level: "B",
    title: "ekofarma5.com",
    author: "Family EcoFarm No. 5",
    date: "accessed 28 Sep 2026",
    type: "Operator's own website",
    context: "39,180 m² (almost 4 ha); vegetables, fruit trees.",
    use: "Basic farm profile.",
    avoid: "Marketing language.",
    url: "https://www.ekofarma5.com/"
  },
  iep: {
    pill: "Official data", level: "B",
    title: "Na poliach pusto — O škodlivosti rozľahlých monokultúr na ornej pôde (Commentary 2020/5)",
    author: "Martin Gális, Institute for Environmental Policy (IEP), Ministry of Environment SR",
    date: "May 2020 · satellite field data from 2018",
    type: "Government analysis",
    context: "Uses OneSoil satellite field detection. Average single-crop field: Slovakia 12 ha — the largest in the EU; EU average 3.9 ha; Trnava Region 18.2 ha. Large uniform fields: water and wind erosion, fast runoff, no shelter for game and insects.",
    use: "12 ha, 3.9 ha, 18.2 ha and the mechanisms of harm.",
    avoid: "Not a 2026 measurement.",
    url: "https://www.minzp.sk/files/iep/2020_5_na_poliach_pusto.pdf"
  },
  euwfd: {
    pill: "EU law", level: "B",
    title: "Waste Framework Directive 2008/98/EC, Article 22 (as amended in 2018)",
    author: "European Union",
    date: "obligation from 31 December 2023",
    type: "Legislation",
    context: "Bio-waste must be separated at source or collected separately.",
    use: "Why there is a brown bin for bio-waste.",
    avoid: "—",
    url: "https://eur-lex.europa.eu/eli/dir/2008/98/oj"
  },
  oneearth: {
    pill: "Peer-reviewed", level: "B",
    title: "Methane emissions along biomethane and biogas supply chains are underestimated",
    author: "Semra Bakkaloglu, Jasmin Cooper, Adam Hawkes — Imperial College London · One Earth 5(6)",
    date: "17 June 2022",
    type: "Peer-reviewed synthesis of measurement studies (+ Imperial College press release)",
    context: "Up to twice as much methane as the International Energy Agency's highest estimate. 62 % of the leaks came from a small number of facilities and pieces of equipment („super-emitters“). Biogas and biomethane still remain climate-friendlier than fossil alternatives.",
    use: "Why operation and leak control decide the result.",
    avoid: "It is a global synthesis, not a measurement of Slovak plants.",
    url: "https://doi.org/10.1016/j.oneear.2022.05.012"
  },
  eox: {
    pill: "Satellite", level: "B",
    title: "Sentinel-2 cloudless mosaics 2016 and 2024",
    author: "EOX IT Services GmbH (contains modified Copernicus Sentinel data)",
    date: "2016 (CC BY 4.0), 2024 (CC BY-NC-SA 4.0)",
    type: "Satellite imagery (10 m resolution)",
    context: "Used for location and landscape context.",
    use: "What the landscape looks like from above.",
    avoid: "Parcel-level claims (10 m pixels are too coarse).",
    url: "https://s2maps.eu"
  },
  naturefood: {
    pill: "Peer-reviewed", level: "B",
    title: "Current status and future challenges in implementing and upscaling vertical farming systems",
    author: "van Delden et al., Nature Food 2, 944–956",
    date: "2021",
    type: "Peer-reviewed review",
    context: "Water and nutrient use efficiency can approach 100 %; lighting energy is the main challenge (about 28 m² of solar panels per m² of land for a 9-layer farm).",
    use: "Backup scene only: a balanced view of vertical farming.",
    avoid: "„It solves farming“.",
    url: "https://doi.org/10.1038/s43016-021-00402-w"
  },
  // ------------------------------------------------------------- C · journalism
  ctzn: {
    pill: "Denník N", level: "C",
    title: "Bioodpad od Bratislavčanov menia na biouhlie, ktoré regeneruje pôdu",
    author: "CTZN / Denník N (on-site report; speakers from Zdroje Zeme a.s.)",
    date: "30 July 2024",
    type: "Journalism",
    context: "One plant in Horné Jatovo (Trnovec nad Váhom) at the time of the visit: kitchen waste from Bratislava; up to 12 % of deliveries did not belong in bio-waste (even a printer and rebar); hygienisation at 70 °C for at least an hour; gas from dry digestion with less than 40 % methane could only go through a biofilter — „about 20 %“ lost this way; a biomethane upgrade was planned; digestate → fertiliser and biochar.",
    use: "A real Slovak circular plant — and a real problem it was fixing.",
    avoid: "Generalising to all biogas plants; assuming the 2024 problem still exists in 2026.",
    url: "https://ctzn.punkt.sk/bioodpad-od-bratislavcanov-menia-na-biouhlie-ktore-regeneruje-podu/"
  },
  tasrhron: {
    pill: "TASR", level: "C",
    title: "Únik digestátu z bioplynovej stanice spôsobil na Hrone masový úhyn rýb",
    author: "TASR (teraz.sk), quoting the operator of Bioplyn Budča and the local fishing association",
    date: "26 July 2021",
    type: "Journalism (news agency)",
    context: "A storm made a tree fall on the bag that stored digestate at the biogas plant in Budča (Zvolen district). About 400 m³ of digestate leaked into the Biensky stream and the Hron river; fish died. The fishermen called it an ecological catastrophe.",
    use: "What can fail at the very end of the loop: storage.",
    avoid: "Blame, money estimates, claims about other plants. Our teacher first sent us an Aktuality.sk report about the same event.",
    url: "https://www.teraz.sk/regiony/policia-zaobera-sa-situaciou-na-riek/565617-clanok.html"
  },
  smepartridge: {
    pill: "SME · BirdLife", level: "C",
    title: "Jarabice boli typickým obrazom krajiny, za 50 rokov ich početnosť poklesla o 99 percent",
    author: "SME (Doma v záhrade), data from SOS/BirdLife Slovensko",
    date: "7 February 2025",
    type: "Journalism quoting a conservation organisation",
    context: "Causes named: collectivisation, ploughed-out field margins, intensification.",
    use: "Up to −99 % in 50 years, attributed.",
    avoid: "Other sources give −90 %; we do not mix figures.",
    url: "https://www.sme.sk/zahrada/c/krdliky-jarabic-boli-typickym-obrazom-krajiny"
  },
  dnpartridge: {
    pill: "Denník N", level: "C",
    title: "Kedysi tu žili státisíce jarabíc, dnes z ich populácie zostáva posledné percento",
    author: "Denník N",
    date: "30 March 2021",
    type: "Journalism (paywalled — headline only)",
    context: "The same finding, reported in 2021.",
    use: "Headline as media context.",
    avoid: "Numbers from the article body (not read).",
    url: "https://dennikn.sk/2323044/kedysi-tu-zili-statisice-jarabic-dnes-zostava-z-ich-populacie-posledne-percento-ine-druhy-su-na-tom-podobne/"
  },
  defields: {
    pill: "Denník E", level: "C",
    title: "Satelity ukázali, že sme európski rekordéri vo veľkosti polí s jednou plodinou",
    author: "Denník E",
    date: "14 May 2020",
    type: "Journalism (paywalled — not read in full)",
    context: "Reports the IEP analysis. We use the original IEP study for numbers.",
    use: "Media context only.",
    avoid: "Any number not in the IEP original.",
    url: "https://e.dennikn.sk/1892510/satelity-ukazali-ze-sme-europski-rekorderi-vo-velkosti-poli-s-jednou-plodinou"
  },
  skalica: {
    pill: "Aktuality", level: "C",
    title: "Odpadový biznis v meste trdelníkov: toxické jazero, fiktívne kúpený stroj…",
    author: "Aktuality.sk (investigative report)",
    date: "10 September 2026",
    type: "Journalism about an ongoing dispute",
    context: "Construction-waste site in Skalica's industrial zone. Confirmed by institutions in the article: inspection by the Slovak Environmental Inspectorate on 29 Jul 2026 (not concluded); the Slovak Land Fund reports environmental degradation on land it leases. Other points are alleged or under investigation.",
    use: "Backup scene only: what happens when waste governance fails.",
    avoid: "Names, blame, and any disputed claim as fact. Not agricultural waste.",
    url: "https://www.aktuality.sk/clanok/imNVPmp/odpadovy-biznis-v-meste-trdelnikov-toxicke-jazero-fiktivne-kupeny-stroj-a-stopy-k-znamemu-prokuratorovi/"
  },
  slovnaft: {
    pill: "SME", level: "C",
    title: "Spaľovňa Slovnaftu — postoje kandidátov na primátora",
    author: "Marek Moravčík, SME Bratislava",
    date: "21 July 2026",
    type: "Journalism",
    context: "Planned waste incinerator in south Bratislava: 220,000 t a year (reduced from 317,000 after public criticism); favourable EIA opinion in July 2026.",
    use: "Backup scene only: what happens to waste that cannot be reused or treated biologically.",
    avoid: "Candidates' positions as science.",
    url: "https://www.sme.sk/bratislava/c/o-parkovani-hovoria-vsetci-o-spalovni-slovnaftu-takmer-nikto-ako-sa-k-nej-stavaju-kandidati-na-primatora"
  },
  // ------------------------------------------------------------- D · industry view
  sba: {
    pill: "Industry view", level: "D",
    title: "Bioplynky s kompostárňami nespolupracujú, čo bráni lepšej likvidácii odpadov",
    author: "Aktuality.sk; all claims from the Slovak Biogas Association (Matej Štefánek)",
    date: "31 August 2022",
    type: "Industry association view",
    context: "Argues that biogas plants and composting plants should cooperate: woody material suits composting; liquid waste, animal by-products and oils suit biogas plants. Says commercial bio-waste „often doesn't exist on paper“.",
    use: "Which materials suit which process — always as „according to the Slovak Biogas Association“.",
    avoid: "Promotional claims.",
    url: "https://www.aktuality.sk/clanok/ZeFhCdk/bioplynky-s-kompostarnami-nespolupracuju-co-brani-lepsej-likvidacii-odpadov/"
  },
  // ------------------------------------------------------------- E · explainers, blogs, notes
  spravabudovy: {
    pill: "Explainer", level: "E",
    title: "Ako funguje bioplynová stanica",
    author: "SprávaBudovy.sk",
    date: "updated 6 October 2025",
    type: "Popular technical explainer (very positive framing)",
    context: "Process description: inputs, digester, temperatures (35–40 °C or 50–55 °C), CHP, biomethane, digestate.",
    use: "How the process works.",
    avoid: "Its evaluative claims („practically waste-free“).",
    url: "https://spravabudovy.sk/bioplynova-stanica/"
  },
  veda: {
    pill: "Explainer", level: "E",
    title: "Ohrozená jarabica",
    author: "Jozef Ferenec (Slovak Hunting Association), Veda na dosah / CVTI SR",
    date: "undated",
    type: "Popular science",
    context: "Partridges eat seeds and insects; they need a mosaic of crops, fallows and field margins.",
    use: "The ecological mechanism.",
    avoid: "Its −90 % figure.",
    url: "https://vedanadosah.cvtisr.sk/priroda/biologia/ohrozena-jarabica/"
  },
  dnblog: {
    pill: "Company blog", level: "E",
    title: "Potravinová aj energetická nezávislosť vďaka vertikálnym farmám",
    author: "VYBO Electric (paid blog on Denník N)",
    date: "22 August 2025",
    type: "Company blog (paywalled — not read in full)",
    context: "Promotes vertical farms. Sent to us by our teacher as an idea for the future of farming.",
    use: "Backup scene only: „companies promote this“.",
    avoid: "Its percentages (water savings, payback).",
    url: "https://dennikn.sk/blog/4804911/potravinova-aj-energeticka-nezavislost-vdaka-vertikalnym-farmam/"
  },
  teamnotes: {
    pill: "Team notes", level: "E",
    title: "Working notes by Sára Trajlinková and Karolína Rybáriková",
    author: "Our team",
    date: "28 September 2026",
    type: "Research leads",
    context: "Summaries of Statok Dubina and EcoFarm No. 5 prepared by classmates.",
    use: "As leads, checked against the original sources.",
    avoid: "Details not confirmed by the original source (e.g. the exact number of horses).",
    url: ""
  }
};
