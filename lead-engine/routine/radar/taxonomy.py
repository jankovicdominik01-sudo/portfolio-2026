# -*- coding: utf-8 -*-
"""
Kategórie SK + CZ: synonymá (evidencia pre klasifikáciu), discovery query packy, predvolený volajúci.

Predvolený volajúci je iba ŠTART — routing sa dá zmeniť v Lead Engine (Nastavenia → Routing).
Rozdelenie nie je podľa pohlavia volajúceho, ale podľa segmentu/call flow, aby sa dali merať výsledky.

Regexy sa púšťajú na text BEZ diakritiky, malými písmenami (normalize.bez).
"""
import re

# id = kategória v Lead Engine (stabilné, sú v dátach), code = kód zo zadania.
# core = čo musí evidencia obsahovať, aby sme kategóriu tvrdili; avoid = čo ju vylučuje (predajca, reťazec…).
# terms_sk / terms_cz = výrazy pre discovery vyhľadávanie; azet / zoznam / zs = katalógové sekcie (iba SK).
# ig = Instagram je pre segment prirodzený kanál (social-first je častý); portfolio = ukazujú prácu (realizácie).
CATS = {
    # ───────── SOŇA (vizuálne / osobné služby, reality, interiér) ─────────
    "kadernictvo": dict(code="HAIR", caller="sona", label="Kaderníctvo", ig=True, portfolio=True,
                        core=r"kadern|kadernic|hair ?(salon|studio|stylist)|vlas(y|ov|u)\b|strih|farbenie vlas|balayage|"
                             r"kadernictvi|kadernice|stylist",
                        avoid=r"skol(a|y) kadern|velkoobchod|e-?shop s vlas|parochn",
                        terms_sk=["kaderníctvo", "kadernícky salón"], terms_cz=["kadeřnictví", "kadeřnice"],
                        azet=["kadernictva"]),
    "barber": dict(code="BARBER", caller="sona", label="Barber", ig=True, portfolio=True,
                   core=r"barber|pansk(e|y) strih|holic(stvo|tvi)", avoid=r"",
                   terms_sk=["barbershop", "barber"], terms_cz=["barbershop", "pánské holičství"]),
    "makeup": dict(code="MAKEUP", caller="sona", label="Make-up / vizáž", ig=True, portfolio=True,
                   core=r"make ?-?up|vizaz|licenie|liceni|makeup artist|mua\b|svadobn(e|y) licen", avoid=r"predaj kozmetiky|drogeri",
                   terms_sk=["vizážistka", "makeup artist"], terms_cz=["vizážistka", "make-up artist"], azet=["vizazisti"]),
    "nechty": dict(code="NAILS", caller="sona", label="Nechty / manikúra", ig=True, portfolio=True,
                   core=r"necht|nehty|nehtov|manikur|pedikur|gel lak|nail", avoid=r"velkoobchod|e-?shop",
                   terms_sk=["nechtové štúdio", "manikúra"], terms_cz=["nehtové studio", "manikúra"], azet=["nechtove-studia"]),
    "mihalnice": dict(code="LASHES", caller="sona", label="Mihalnice / obočie", ig=True, portfolio=True,
                      core=r"mihaln|rasy|rasnic|lash|obocie|oboci|brow|laminaci", avoid=r"",
                      terms_sk=["predlžovanie mihalníc", "laminácia obočia"], terms_cz=["prodlužování řas", "laminace obočí"]),
    "kozmetika": dict(code="BEAUTY", caller="sona", label="Kozmetika / beauty", ig=True, portfolio=False,
                      core=r"kozmetick(y|e|a) (salon|studio)|kosmeticky (salon|studio)|kozmetik|kosmetik|beauty|pletov|"
                           r"osetrenie pleti|osetreni pleti|depilac|epilac",
                      avoid=r"drogeri|parfumer|predaj kozmetiky|e-?shop|velkoobchod|notino|douglas",
                      terms_sk=["kozmetický salón", "beauty salón"], terms_cz=["kosmetický salon", "beauty salon"],
                      azet=["kozmeticke-salony"]),
    "fotograf": dict(code="PHOTOGRAPHY", caller="sona", label="Fotograf", ig=True, portfolio=True,
                     core=r"fotograf|fotenie|foceni|fotostudio|photograph|photo ?studio", avoid=r"fotolab|predaj fotoapar|minilab",
                     terms_sk=["fotograf", "svadobný fotograf"], terms_cz=["fotograf", "svatební fotograf"], azet=["fotografovanie"]),
    "video": dict(code="VIDEO", caller="sona", label="Video", ig=True, portfolio=True,
                  core=r"kameraman|videoprodukc|svadobne video|svatebni video|videograf|video ?produkc|filmar", avoid=r"",
                  terms_sk=["kameraman", "svadobné video"], terms_cz=["kameraman", "svatební video"]),
    "svadby": dict(code="WEDDING", caller="sona", label="Svadobné služby", ig=True, portfolio=True,
                   core=r"svadob|svatebn|wedding|vyzdob(a|y) svad|koordinator", avoid=r"",
                   terms_sk=["svadobná agentúra", "výzdoba svadieb"], terms_cz=["svatební agentura", "výzdoba svateb"]),
    "reality": dict(code="REAL_ESTATE", caller="sona", label="Reality / makléri", ig=True, portfolio=True,
                    core=r"realit|makler|nehnutelnost|nemovitost", avoid=r"",
                    terms_sk=["realitný maklér", "realitná kancelária"], terms_cz=["realitní makléř", "realitní kancelář"],
                    azet=["reality-a-realitne-kancelarie"]),
    "developer": dict(code="DEVELOPER", caller="sona", label="Developer", ig=True, portfolio=True,
                      core=r"developer|developersk|rezidencn(y|i) projekt|novostavby bytov", avoid=r"software|web developer|vyvojar",
                      terms_sk=["developerský projekt"], terms_cz=["developerský projekt"]),
    "interier": dict(code="INTERIOR_DESIGN", caller="sona", label="Interiérový dizajn", ig=True, portfolio=True,
                     core=r"interier(ov(y|e|eho)|n(y|i)) (dizajn|design|architekt)|interior design|navrh(y)? interier|design interier|"
                          r"bytov(y|e|a) (dizajn|design|architekt)",
                     avoid=r"predaj nabytku|e-?shop|ikea|asko|sconto",
                     terms_sk=["interiérový dizajnér", "návrh interiéru"], terms_cz=["interiérový designer", "návrh interiéru"],
                     azet=["interierovy-dizajn"]),
    "architekt": dict(code="ARCHITECTURE", caller="sona", label="Architekt", ig=True, portfolio=True,
                      core=r"architekt|architekton|projektov(a|e) kancelari|architectur", avoid=r"software|it architekt",
                      terms_sk=["architekt rodinné domy", "architektonické štúdio"], terms_cz=["architekt rodinné domy", "architektonický ateliér"]),

    # ───────── JOZO (remeslá, stavba, auto) ─────────
    "stolarstvo": dict(code="CUSTOM_FURNITURE", caller="jozo", label="Stolárstvo / nábytok na mieru", ig=True, portfolio=True,
                       core=r"stolar|truhlar|nabytok na mier|nabytek na mir|vstavan(e|a) skrin|vestaven(e|a) skrin|"
                            r"kuchynsk(e|a) link|kuchyne na mier|kuchyne na mir|schodisk|dvere na mier",
                       avoid=r"predaj nabytku|velkoobchod|ikea|asko|sconto|e-?shop s nabytkom",
                       terms_sk=["stolárstvo", "nábytok na mieru"], terms_cz=["truhlářství", "nábytek na míru"],
                       azet=["stolarstvo_2"], zs=["stolarstvo"], bazos=["stolárstvo", "stolár", "kuchynské linky na mieru"]),
    "kuchyne": dict(code="KITCHENS", caller="jozo", label="Kuchyne na mieru", ig=True, portfolio=True,
                    core=r"kuchyne na mier|kuchyne na mir|kuchynsk(e|a) link|kuchynske studio|kuchynske studio",
                    avoid=r"spotrebic|velkoobchod|ikea|sconto",
                    terms_sk=["kuchyne na mieru", "kuchynské linky na mieru"], terms_cz=["kuchyně na míru", "kuchyňské linky na míru"]),
    "zahradnictvo": dict(code="GARDEN", caller="jozo", label="Záhrady / záhradníctvo", ig=True, portfolio=True,
                         core=r"zahradn(i|e)c|zahradn(e|i) (centr|realiz|sluzb|prace|architekt)|okrasn|dreviny|trvalk|"
                              r"realizac\w* zahrad|udrzb\w* (zelene|zahrad)|udrzb\w* zahrad|sadov|zavlah|travnik|skolk|"
                              r"navrh\w* zahrad|zahradni architekt|zahradnik",
                         avoid=r"hodink|zahradn\w* techni|motorov|traktor|velkoobchod s ovoc|kvetinarstv|kytic|zahradkarsk\w* potreby",
                         terms_sk=["realizácia záhrad", "záhradník"], terms_cz=["realizace zahrad", "zahradník"],
                         azet=["zahradne-centra", "navrhy-a-upravy-zahrad", "zahradnicke-a-aranzerske-sluzby", "udrzba-zelene"],
                         zs=["zahradnictvo", "zahradne-sluzby", "sadovnicke-upravy"],
                         bazos=["údržba záhrad", "záhradník", "realizácia záhrad"]),
    "stavebnictvo": dict(code="CONSTRUCTION", caller="jozo", label="Stavebníctvo / rekonštrukcie", ig=True, portfolio=True,
                         core=r"rekonstruk|stavebn(a|e|i) (firma|prace|spolocnost|spolecnost)|vystavba|vystavba domov|"
                              r"murar|zednick|rodinn(e|y|ych) dom(y|ov|u)|hrub(a|e) stavb|stavby na klic|stavby na kluc|"
                              r"prerabk|zatepl",
                         avoid=r"stavebnin|predaj stavebn|pozicovna|developer|realit",
                         terms_sk=["rekonštrukcie bytov", "stavebná firma rodinné domy"], terms_cz=["rekonstrukce bytů", "stavební firma rodinné domy"],
                         azet=["murarske-prace"], bazos=["rekonštrukcie", "murárske práce"]),
    "murari": dict(code="CONSTRUCTION", caller="jozo", label="Murári", ig=False, portfolio=True,
                   core=r"murar|omietk|zednick|murovan", avoid=r"stavebnin",
                   terms_sk=["murárske práce"], terms_cz=["zednické práce"], azet=["murarske-prace"]),
    "maliar": dict(code="PAINTER", caller="jozo", label="Maliar / natierač", ig=False, portfolio=True,
                   core=r"maliar|natierac|malovani|malir|natery|stierk|maliarske prace|malirske prace", avoid=r"umelec|obraz(y|ov) na predaj|galeria",
                   terms_sk=["maliarske práce", "maliar natierač"], terms_cz=["malířské práce", "malíř pokojů"], azet=["maliari"]),
    "podlahy": dict(code="FLOORING", caller="jozo", label="Podlahy", ig=True, portfolio=True,
                    core=r"podlah|parket|laminat|vinyl|epoxid", avoid=r"velkoobchod",
                    terms_sk=["podlahár", "pokládka podláh"], terms_cz=["podlahář", "pokládka podlah"],
                    azet=["plavajuca-podlaha-a-parkety"], zs=["podlahy"]),
    "obklady": dict(code="CONSTRUCTION", caller="jozo", label="Obklady a dlažby", ig=True, portfolio=True,
                    core=r"obklad|dlazb|obkladac", avoid=r"predaj obkladov|velkoobchod|siko|keramika predaj",
                    terms_sk=["obkladač", "obklady a dlažby"], terms_cz=["obkladač", "obklady a dlažby"], zs=["obklady"]),
    "strechy": dict(code="ROOFING", caller="jozo", label="Strechy / klampiari", ig=False, portfolio=True,
                    core=r"strech|pokryvac|pokryvac|klampiar|klempir|odkvap|strecha|strechy", avoid=r"velkoobchod",
                    terms_sk=["pokrývač", "klampiar strechy"], terms_cz=["pokrývač", "klempíř střechy"],
                    azet=["strechy", "klampiari-a-pokryvaci"], zs=["strechy", "klampiarstvo"]),
    "fasady": dict(code="FACADE", caller="jozo", label="Fasády / zatepľovanie", ig=False, portfolio=True,
                   core=r"fasad|zatepl|termofasad", avoid=r"velkoobchod",
                   terms_sk=["zatepľovanie fasád"], terms_cz=["zateplení fasád"]),
    "elektrikar": dict(code="ELECTRICIAN", caller="jozo", label="Elektrikár", ig=False, portfolio=False,
                       core=r"elektrikar|elektroinstal|elektromontaz|elektroinstalac|revizie elektro|revize elektro", avoid=r"predaj elektro|elektro obchod|velkoobchod",
                       terms_sk=["elektrikár", "elektroinštalácie"], terms_cz=["elektrikář", "elektroinstalace"],
                       azet=["elektrikari", "elektroinstalacie"], zs=["elektrikar"]),
    "vodoinstalater": dict(code="PLUMBER", caller="jozo", label="Vodoinštalatér", ig=False, portfolio=False,
                           core=r"vodoinstal|instalater|kanaliz|vodar|topenar", avoid=r"velkoobchod|predaj sanit",
                           terms_sk=["vodoinštalatér"], terms_cz=["instalatér"], azet=["instalaterstvo"], zs=["vodoinstalater"]),
    "kurenie": dict(code="HEATING", caller="jozo", label="Kúrenie / kotly", ig=False, portfolio=False,
                    core=r"kurenie|topeni|kotl(e|y|ov)|tepeln(e|a|ych) cerpadl|podlahov(e|a) kuren|podlahov(e|a) topen|plynar", avoid=r"velkoobchod",
                    terms_sk=["kúrenie montáž", "tepelné čerpadlá montáž"], terms_cz=["topení montáž", "tepelná čerpadla montáž"], azet=["kurenie_1"]),
    "autoservis": dict(code="CAR_SERVICE", caller="jozo", label="Autoservis", ig=False, portfolio=False,
                       core=r"autoservis|autoopravovn|oprava aut|servis vozidiel|servis vozidel|autodiagnost", avoid=r"autobazar|predaj aut|autoskol|pozicovn",
                       terms_sk=["autoservis"], terms_cz=["autoservis"], azet=["autoservisy"]),
    "pneuservis": dict(code="TIRE_SERVICE", caller="jozo", label="Pneuservis", ig=False, portfolio=False,
                       core=r"pneuservis|prezutie|prezuti|pneumatik", avoid=r"e-?shop|velkoobchod",
                       terms_sk=["pneuservis"], terms_cz=["pneuservis"], azet=["pneuservisy"]),
    "detailing": dict(code="DETAILING", caller="jozo", label="Auto detailing", ig=True, portfolio=True,
                      core=r"detailing|tepovanie aut|cistenie interier|keramick(a|e) ochran|lestenie laku|lesteni laku|ppf fol", avoid=r"autoumyvark|e-?shop",
                      terms_sk=["auto detailing"], terms_cz=["auto detailing"]),
    "brany-ploty": dict(code="GATES_FENCES", caller="jozo", label="Brány a ploty", ig=True, portfolio=True,
                        core=r"bran(y|a)|plot(y|ov)|oplot|pergol|zabradl", avoid=r"velkoobchod|predajna",
                        terms_sk=["brány a ploty", "pergoly na mieru"], terms_cz=["brány a ploty", "pergoly na míru"], zs=["brany-a-ploty"]),
    "kovovyroba": dict(code="OTHER_LOCAL_SERVICE", caller="jozo", label="Kovovýroba / zváranie", ig=True, portfolio=True,
                       core=r"zamocn|zamecn|zvar|kovovyrob|zabradl|nerez", avoid=r"kovosrot|velkoobchod",
                       terms_sk=["zámočníctvo", "kovovýroba"], terms_cz=["zámečnictví", "kovovýroba"], azet=["kovovyroba", "zamocnici_2"]),
    "tesari": dict(code="CONSTRUCTION", caller="jozo", label="Tesári / krovy", ig=True, portfolio=True,
                   core=r"tesar|krov|drevostav|pergol", avoid=r"",
                   terms_sk=["tesárstvo", "krovy"], terms_cz=["tesařství", "krovy"], azet=["tesarske-prace"]),
    "kominarstvo": dict(code="OTHER_LOCAL_SERVICE", caller="jozo", label="Kominárstvo", ig=False, portfolio=False,
                        core=r"kominar|kominic|komin", avoid=r"",
                        terms_sk=["kominár"], terms_cz=["kominík"]),
    "ine": dict(code="OTHER_LOCAL_SERVICE", caller=None, label="Iná lokálna služba", ig=False, portfolio=False,
                core=r"$^", avoid=r"", terms_sk=[], terms_cz=[]),
}

SONA_DEFAULT = sorted(k for k, v in CATS.items() if v["caller"] == "sona")
JOZO_DEFAULT = sorted(k for k, v in CATS.items() if v["caller"] == "jozo")

# Ktoré kategórie sa NIKDY neberú (iný biznis model / nízka potreba webu v tejto ponuke).
NEVER = re.compile(r"kvetinar|aranzovan\w* kytic|donask\w* kvet|cukrar|pekar|psi salon|psie salon|strihanie psov|restaurac|pizz|bistro|kaviar|pohostin|taxi|"
                   r"stahovan|upratov|autoskol|lekar|zubar|stomatolog|lekaren|poistov|advokat|notar|ucto|danov",
                   re.I)


def compiled(cat_id):
    """Výrazy sú KMENE slov → porovnávajú sa od začiatku slova („pobočiek“ nie je „obočie“)."""
    c = CATS[cat_id]
    return re.compile(r"\b(?:" + c["core"] + ")", re.I), (re.compile(r"\b(?:" + c["avoid"] + ")", re.I) if c.get("avoid") else None)


def default_caller(cat_id, routing=None):
    """Volajúci pre kategóriu: konfigurácia (routing z Lead Engine) má prednosť pred predvolenou."""
    if routing and routing.get(cat_id):
        return routing[cat_id]
    return CATS.get(cat_id, CATS["ine"])["caller"]


# ───────── Lokality ─────────
CITIES = {
    "SK": ["Bratislava", "Trnava", "Nitra", "Trenčín", "Žilina", "Banská Bystrica", "Prešov", "Košice", "Senica", "Skalica",
           "Holíč", "Myjava", "Malacky", "Piešťany", "Hlohovec", "Galanta", "Dunajská Streda", "Senec", "Pezinok",
           "Topoľčany", "Nové Zámky", "Komárno", "Levice", "Šaľa", "Prievidza", "Považská Bystrica", "Púchov",
           "Nové Mesto nad Váhom", "Martin", "Ružomberok", "Liptovský Mikuláš", "Dolný Kubín", "Čadca", "Zvolen",
           "Lučenec", "Poprad", "Kežmarok", "Spišská Nová Ves", "Bardejov", "Humenné", "Michalovce", "Stupava",
           "Modra", "Sereď", "Vrbové", "Stará Turá", "Brezová pod Bradlom", "Gbely", "Šaštín-Stráže"],
    "CZ": ["Brno", "Hodonín", "Břeclav", "Kyjov", "Veselí nad Moravou", "Strážnice", "Uherské Hradiště", "Uherský Brod",
           "Zlín", "Otrokovice", "Kroměříž", "Vsetín", "Olomouc", "Prostějov", "Přerov", "Ostrava", "Opava",
           "Frýdek-Místek", "Mikulov", "Hustopeče", "Znojmo", "Vyškov", "Blansko", "Jihlava", "Třebíč", "Praha",
           "Plzeň", "České Budějovice", "Hradec Králové", "Pardubice", "Liberec", "Luhačovice", "Bzenec", "Dubňany",
           "Lanžhot", "Valtice", "Lednice", "Velké Pavlovice", "Slavkov u Brna", "Kuřim"],
}
# Susedné lokality pre rozšírenie, keď mesto dá málo firiem (nie celá republika naraz).
NEIGHBORS = {
    "Senica": ["Skalica", "Holíč", "Myjava", "Šaštín-Stráže", "Brezová pod Bradlom"],
    "Skalica": ["Holíč", "Senica", "Gbely", "Hodonín", "Strážnice"],
    "Holíč": ["Skalica", "Hodonín", "Gbely", "Senica"],
    "Myjava": ["Senica", "Stará Turá", "Brezová pod Bradlom", "Nové Mesto nad Váhom"],
    "Malacky": ["Stupava", "Senica", "Bratislava", "Šaštín-Stráže"],
    "Trnava": ["Hlohovec", "Piešťany", "Sereď", "Senica", "Pezinok"],
    "Bratislava": ["Senec", "Pezinok", "Stupava", "Malacky", "Modra"],
    "Nitra": ["Topoľčany", "Šaľa", "Levice", "Nové Zámky"],
    "Hodonín": ["Břeclav", "Kyjov", "Strážnice", "Veselí nad Moravou", "Skalica", "Holíč", "Dubňany"],
    "Břeclav": ["Hodonín", "Mikulov", "Hustopeče", "Lanžhot", "Valtice", "Lednice"],
    "Kyjov": ["Hodonín", "Veselí nad Moravou", "Bzenec", "Uherské Hradiště"],
    "Brno": ["Kuřim", "Slavkov u Brna", "Blansko", "Vyškov", "Hustopeče"],
    "Zlín": ["Otrokovice", "Uherské Hradiště", "Luhačovice", "Vsetín", "Kroměříž"],
    "Uherské Hradiště": ["Uherský Brod", "Veselí nad Moravou", "Zlín", "Kyjov"],
}


def neighbors(city, country):
    if city in NEIGHBORS:
        return NEIGHBORS[city]
    lst = CITIES.get(country, [])
    if city in lst:
        i = lst.index(city)
        return [c for c in lst[max(0, i - 2): i + 3] if c != city]
    return []


def terms(cat_id, country):
    c = CATS[cat_id]
    return c["terms_cz"] if country == "CZ" else c["terms_sk"]
