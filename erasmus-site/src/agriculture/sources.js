// Every claim on screen points to one of these. Levels:
// A = our own research, B = official / peer-reviewed, C = journalism,
// D = industry view, E = explainer / blog / team note.
export const SOURCES = {
  vince: {
    pill: "Our interview", level: "A",
    title: "Answers to our questions: Family EcoFarm No. 5",
    author: "Ing. Jozef Vince, MSc., Family EcoFarm No. 5 (Galanta)",
    date: "22 September 2026",
    type: "Direct email response to our student team",
    context: "We asked six questions by email on 22 Sep 2026; he answered the same evening. Quotes are translated from Slovak; the original wording is kept in our research file.",
    use: "Farming approach, pest protection, soil fertility, drought losses in 2026, farm waste, economics.",
    avoid: "It is one farmer's experience — no measured data, not a claim about all organic farms.",
    url: "https://www.ekofarma5.com/"
  },
  tssenica: {
    pill: "Field data", level: "A",
    title: "Answers about the Senica composting plant",
    author: "Ing. Marian Fojtlín, head of the municipal works division, Technické služby Senica a.s.",
    date: "23 September 2026",
    type: "Direct email response to our student team (operator data)",
    context: "Detailed description of inputs, volumes, process, hygienisation and problems. Visit confirmed for 30 Sep 2026, 9:00.",
    use: "2025 volumes, capacity, process steps, temperatures, output, contaminants.",
    avoid: "Operator's own description, not an independent audit. The input/output difference is not explained yet.",
    url: "https://www.tssenica.sk/"
  },
  fieldvisit: {
    pill: "Field visit", level: "A",
    title: "Our visit to the Senica composting plant",
    author: "SSOŠP Senica Erasmus+ team",
    date: "30 September 2026",
    type: "Own field research: photos, video, questions, observations",
    context: "Added after the visit.",
    use: "What we saw and measured ourselves.",
    avoid: "—",
    url: ""
  },
  infopack: {
    pill: "Official", level: "B",
    title: "Infopack: Young Ambassadors of Ecological Agriculture (2025-1-TR01-KA152-YOU-00301481)",
    author: "Mezitli District Directorate of Agriculture and Forestry",
    date: "2026",
    type: "Project brief",
    context: "Youth exchange in Mezitli / Mersin, 8–14 Oct 2026. Preliminary task: sustainable practices, environmental issues and good/bad agricultural waste practices in our region.",
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
    context: "8 ha of arable land between Horné and Dolné Zelenice, 60 years of intensive farming; revitalised since 2012.",
    use: "Size, history, practices, the farmer's quote, the experts' observations.",
    avoid: "No number of horses; no measured soil data; self-sufficiency is a goal.",
    url: "https://krajinaziva.sk/en/hospodari/statok-dubina/"
  },
  kzecofarm: {
    pill: "Official · BROZ", level: "B",
    title: "Rodinná EkoFarma No. 5 — Krajina živá profile",
    author: "BROZ — Krajina živá programme (expert panel)",
    date: "2022",
    type: "Conservation NGO programme, farm award profile",
    context: "Former vineyard unused for ~30 years; agroforestry; soil chromatography; experts' quotes.",
    use: "Context and expert quotes.",
    avoid: "Relative dates in the text („four years ago“) are from 2022.",
    url: "https://krajinaziva.sk/hospodari/rodinna-ekofarma-no-5/"
  },
  ecofarmweb: {
    pill: "Farm website", level: "B",
    title: "ekofarma5.com",
    author: "Family EcoFarm No. 5",
    date: "accessed 28 Sep 2026",
    type: "Operator's own website",
    context: "39,180 m², 24 kinds of vegetables, 25+ trees, rainfall measured since 1 Oct 2019.",
    use: "Basic farm profile.",
    avoid: "Marketing language.",
    url: "https://www.ekofarma5.com/"
  },
  iep: {
    pill: "Official data", level: "B",
    title: "Na poliach pusto — O škodlivosti rozľahlých monokultúr na ornej pôde (Commentary 2020/4)",
    author: "Martin Gális, Institute for Environmental Policy (IEP), Ministry of Environment SR",
    date: "May 2020 · satellite data 2018, field counts 2019",
    type: "Peer-reviewed government analysis (reviewers from ISA and the Slovak Academy of Sciences)",
    context: "Uses OneSoil satellite field detection (≈85 % boundary accuracy).",
    use: "12 ha vs 3.9 ha, Trnava 18.2 ha, 46 % of farmland in fields over 30 ha, mechanisms of harm.",
    avoid: "Not a 2026 measurement.",
    url: "https://www.minzp.sk/files/iep/2020_5_na_poliach_pusto.pdf"
  },
  defields: {
    pill: "Denník E", level: "C",
    title: "Satelity ukázali, že sme európski rekordéri vo veľkosti polí s jednou plodinou",
    author: "Denník E",
    date: "14 May 2020",
    type: "Journalism (paywalled — not read in full)",
    context: "Reports the IEP analysis. We cite the original IEP study for numbers.",
    use: "Media context only.",
    avoid: "Any number not in the IEP original.",
    url: "https://e.dennikn.sk/1892510/satelity-ukazali-ze-sme-europski-rekorderi-vo-velkosti-poli-s-jednou-plodinou"
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
    context: "Same finding reported in 2021.",
    use: "Headline as media context.",
    avoid: "Numbers from the article body (not read).",
    url: "https://dennikn.sk/2323044/kedysi-tu-zili-statisice-jarabic-dnes-zostava-z-ich-populacie-posledne-percento-ine-druhy-su-na-tom-podobne/"
  },
  veda: {
    pill: "Explainer", level: "E",
    title: "Ohrozená jarabica",
    author: "Jozef Ferenec (Slovak Hunting Association), Veda na dosah / CVTI SR",
    date: "undated",
    type: "Popular science",
    context: "Partridges eat seeds and insects; need a mosaic of crops, fallows and field margins.",
    use: "The ecological mechanism.",
    avoid: "Its −90 % figure.",
    url: "https://vedanadosah.cvtisr.sk/priroda/biologia/ohrozena-jarabica/"
  },
  ctzn: {
    pill: "Denník N", level: "C",
    title: "Bioodpad od Bratislavčanov menia na biouhlie, ktoré regeneruje pôdu",
    author: "CTZN / Denník N (on-site report; speakers from Zdroje Zeme a.s.)",
    date: "30 July 2024",
    type: "Journalism",
    context: "Describes one plant in Horné Jatovo (Trnovec nad Váhom, near Šaľa) at the time of the visit.",
    use: "Flow, volumes, contamination, the methane threshold and biofilter detail, the planned fix, biochar.",
    avoid: "Generalising to all biogas plants; assuming the 2024 problem still exists in 2026.",
    url: "https://ctzn.punkt.sk/bioodpad-od-bratislavcanov-menia-na-biouhlie-ktore-regeneruje-podu/"
  },
  sba: {
    pill: "Industry view", level: "D",
    title: "Bioplynky s kompostárňami nespolupracujú, čo bráni lepšej likvidácii odpadov",
    author: "Aktuality.sk; all claims from the Slovak Biogas Association (Matej Štefánek)",
    date: "31 August 2022",
    type: "Industry association view (48 member plant operators)",
    context: "Argues for cooperation between biogas plants and composting plants.",
    use: "Which materials suit which process — always as „according to the SBA“.",
    avoid: "„All waste becomes quality fertiliser“ and other promotional claims.",
    url: "https://www.aktuality.sk/clanok/ZeFhCdk/bioplynky-s-kompostarnami-nespolupracuju-co-brani-lepsej-likvidacii-odpadov/"
  },
  spravabudovy: {
    pill: "Explainer", level: "E",
    title: "Ako funguje bioplynová stanica",
    author: "SprávaBudovy.sk",
    date: "updated 6 October 2025",
    type: "Popular technical explainer (very positive framing)",
    context: "Process description.",
    use: "How the process works: inputs, digester, phases, temperatures, CHP, biomethane, digestate.",
    avoid: "Its evaluative claims („practically waste-free“) and the „100–200 l per m³“ figure.",
    url: "https://spravabudovy.sk/bioplynova-stanica/"
  },
  oneearth: {
    pill: "Peer-reviewed", level: "B",
    title: "Methane emissions along biomethane and biogas supply chains are underestimated",
    author: "Bakkaloglu, Cooper & Hawkes — One Earth 5(6), Imperial College London",
    date: "June 2022",
    type: "Peer-reviewed synthesis of measurement studies",
    context: "Up to 2× the IEA's highest estimate; digestate handling largest source; 5 % of emitters cause 62 % of emissions; still more climate-friendly than fossil alternatives.",
    use: "Why operation and leak control decide the outcome.",
    avoid: "It is not a measurement of Slovak plants.",
    url: "https://doi.org/10.1016/j.oneear.2022.05.012"
  },
  euwfd: {
    pill: "EU law", level: "B",
    title: "Waste Framework Directive 2008/98/EC, Article 22 (as amended 2018)",
    author: "European Union",
    date: "obligation from 31 December 2023",
    type: "Legislation",
    context: "Bio-waste must be separated at source or collected separately.",
    use: "Why separate bio-waste collection exists.",
    avoid: "—",
    url: "https://eur-lex.europa.eu/eli/dir/2008/98/oj"
  },
  eufpr: {
    pill: "EU law", level: "B",
    title: "Regulation (EU) 2019/1009 on EU fertilising products, Annex II",
    author: "European Union",
    date: "2019",
    type: "Legislation",
    context: "Compost and digestate used in EU fertilising products may contain at most 3 g/kg dry matter of glass, metal or plastic above 2 mm.",
    use: "Why contamination matters downstream.",
    avoid: "The later, stricter plastic value (not verified here).",
    url: "https://eur-lex.europa.eu/eli/reg/2019/1009/oj"
  },
  skalica: {
    pill: "Aktuality", level: "C",
    title: "Odpadový biznis v meste trdelníkov: toxické jazero, fiktívne kúpený stroj…",
    author: "Aktuality.sk (investigative report)",
    date: "10 September 2026",
    type: "Journalism about an ongoing dispute",
    context: "Construction-waste site in Skalica's industrial zone. Confirmed by institutions in the article: inspection by the Slovak Environmental Inspectorate on 29 Jul 2026 (not concluded); the Slovak Land Fund reports environmental degradation on land it leases. Other points are alleged or under investigation.",
    use: "An anonymised example of what happens when waste governance fails.",
    avoid: "Names, blame, and any disputed claim as fact. Not agricultural waste.",
    url: "https://www.aktuality.sk/clanok/imNVPmp/odpadovy-biznis-v-meste-trdelnikov-toxicke-jazero-fiktivne-kupeny-stroj-a-stopy-k-znamemu-prokuratorovi/"
  },
  slovnaft: {
    pill: "SME", level: "C",
    title: "Spaľovňa Slovnaftu — postoje kandidátov na primátora",
    author: "Marek Moravčík, SME Bratislava",
    date: "21 July 2026",
    type: "Journalism",
    context: "Planned waste incinerator in south Bratislava: 220,000 t/year (reduced from 317,000 after public criticism); favourable EIA opinion in July 2026.",
    use: "Wider debate: what happens to waste that cannot be reused or treated biologically.",
    avoid: "Candidates' positions as science.",
    url: "https://www.sme.sk/bratislava/c/o-parkovani-hovoria-vsetci-o-spalovni-slovnaftu-takmer-nikto-ako-sa-k-nej-stavaju-kandidati-na-primatora"
  },
  delandfill: {
    pill: "Denník E", level: "C",
    title: "Máme veľa skládok aj zlú kvalitu ovzdušia. Analytici ukázali environmentálne výzvy",
    author: "Denník E",
    date: "4 January 2017",
    type: "Journalism (paywalled — not read)",
    context: "Historical context about landfilling in Slovakia.",
    use: "Listed as background only.",
    avoid: "Its 2017 figures as today's situation.",
    url: "https://e.dennikn.sk/648594/mame-vela-skladok-aj-zlu-kvalitu-ovzdusia-analytici-ukazali-environmentalne-vyzvy/"
  },
  naturefood: {
    pill: "Peer-reviewed", level: "B",
    title: "Current status and future challenges in implementing and upscaling vertical farming systems",
    author: "van Delden et al., Nature Food 2, 944–956",
    date: "2021",
    type: "Peer-reviewed review",
    context: "Water and nutrient use efficiency can approach 100 %; lighting energy is the main challenge (~3 m² of PV per m² of cultivation, ~28 m² per m² of land for 9 layers).",
    use: "Balanced view of vertical farming.",
    avoid: "„It solves farming“.",
    url: "https://doi.org/10.1038/s43016-021-00402-w"
  },
  dnblog: {
    pill: "Company blog", level: "E",
    title: "Potravinová aj energetická nezávislosť vďaka vertikálnym farmám",
    author: "VYBO Electric (paid blog on Denník N)",
    date: "22 August 2025",
    type: "Company blog (paywalled — not read in full)",
    context: "Promotes vertical farms.",
    use: "Only as „companies promote this“.",
    avoid: "Its percentages (water savings, payback).",
    url: "https://dennikn.sk/blog/4804911/potravinova-aj-energeticka-nezavislost-vdaka-vertikalnym-farmam/"
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
  teamnotes: {
    pill: "Team notes", level: "E",
    title: "Working notes by Sára Trajlinková and Karolína Rybáriková",
    author: "Our team",
    date: "28 September 2026",
    type: "Research leads",
    context: "Summaries of Statok Dubina and EcoFarm No. 5 prepared by classmates.",
    use: "As leads, checked against original sources.",
    avoid: "Details not confirmed by the original source (e.g. the exact number of horses).",
    url: ""
  }
};

export const LEVELS = {
  A: "Our own research",
  B: "Official, peer-reviewed and institutional",
  C: "Journalism",
  D: "Industry view",
  E: "Explainers, blogs and team notes"
};
