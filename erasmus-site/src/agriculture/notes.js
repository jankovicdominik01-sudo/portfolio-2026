// Speaker script. One entry per scene, in presentation order.
// say[k] = what the presenter says while step k is on screen (one click = next k).
// Short sentences, B2 English, the words match exactly what the audience sees.
export const PRESENTERS = {
  Dominik: { color: "#dcb45c", role: "systems, trade-offs, process, synthesis" },
  Adam: { color: "#7fb2ff", role: "data, landscape, machines, biogas" },
  Sara: { color: "#a7c96f", role: "opening, region, field visits, results" },
  Karolína: { color: "#e59a7a", role: "the loop, biodiversity, waste" }
};
export const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const SCRIPT = [
  {
    id: "s-cold", presenter: "Sara", time: 60, level: "Easy",
    message: "We start with our own photo: bio-waste with plastic in it. Can it go back to soil?",
    screen: "Our photo from the Senica composting plant: food waste, plastic bags, a puddle. Labels appear. Then the camera sinks into the soil and the title “Back to Soil?” appears with a real soil photo.",
    say: [
      "Good morning, everyone. We are the team from Senica, Slovakia. This photo is from our town, from the 30th of September. It was delivered to the town's composting plant.",
      "Look closer. Food — fruit and vegetables. Plastic bags — many of them still closed. And liquid running out of the pile.",
      "So this is our question today: can this go back to soil? To answer it, we start where our food starts — in the soil.",
      "This is real soil: chernozem, the soil of our lowlands. The dark layer is full of life. Everything on our plates starts here."
    ],
    point: "Step 2: point at the bags, then at the puddle. Step 4: point at the dark layer in the soil photo on the right.",
    transition: "Karolína will show you the route of our talk."
  },
  {
    id: "s-loop", presenter: "Karolína", time: 50, level: "Easy",
    message: "Sustainability is not one technology — it is a system. We followed the whole loop, and we went to see parts of it.",
    screen: "A ring with six stops: soil, agriculture, food, waste, recovery, back to soil. Three photo badges appear. Then the ring shrinks into the top-right corner.",
    say: [
      "Our talk is one loop. Soil gives us agriculture. Agriculture gives us food. Food becomes waste. Waste can be recovered — and go back to the soil. Our main idea is simple: sustainability is not one technology. It is a system.",
      "And we did not only read about it. We went to look. We visited a farming cooperative and the composting plant in Senica, and we interviewed an organic farmer.",
      "Keep this ring in mind. It stays in the corner, so you always know where we are."
    ],
    point: "Step 1: follow the moving dot around the ring. Step 2: point at the three badges. Step 3: point at the corner.",
    transition: "Adam starts with the landscape."
  },
  {
    id: "s-landscape", presenter: "Adam", time: 80, level: "Advanced",
    message: "Huge uniform fields lose water, soil and shelter. A mosaic landscape keeps them.",
    screen: "A satellite photo with “12 ha”. The camera zooms in and three squares grow at true scale. Then a side view of one slope: monoculture with wind, heat and runoff — then a mosaic with strips and trees.",
    say: [
      "Slovakia has very big fields. On satellite images from 2018, the average field with one crop was 12 hectares — the biggest in the EU. The EU average was 3.9. This comes from the Ministry of Environment's analysis from 2020 — so it is not a 2026 number.",
      "These squares have the same scale as the satellite photo. The EU average. Slovakia. And our own Trnava Region: 18.2 hectares. One Slovak field is about 17 football pitches.",
      "Why does it matter? Here is one slope with one big field. Wind lifts the dry soil. The bare ground heats up. When it rains, the water runs off — and takes soil with it.",
      "Now the same slope as a mosaic: a windbreak, grass strips, a small wood. Water soaks in, the wind slows down, animals find shelter. A simple landscape loses water, soil and life."
    ],
    point: "Step 2: the three squares. Step 3: follow the brown dots running to the right. Step 4: the blue dots sinking into the grass strip. The button switches Monoculture / Mosaic.",
    transition: "One bird shows this very clearly. Karolína."
  },
  {
    id: "s-partridge", presenter: "Karolína", time: 40, level: "Easy",
    message: "When field margins disappear, farmland birds disappear: up to −99 % partridges in 50 years.",
    screen: "A real photo of grey partridges. One hundred bird icons; 99 fade away. “−99 %”. Then a chain from field structure to biodiversity.",
    say: [
      "This is the grey partridge. It lives in fields. Imagine one hundred of them.",
      "In fifty years, up to 99 of every 100 disappeared in Slovakia. This number is from BirdLife Slovakia, reported by the newspaper SME in 2025.",
      "Why? Partridges eat seeds and insects, and their chicks need insects. Insects need field margins and wild corners. When the landscape becomes too simple, this chain breaks."
    ],
    point: "Step 2: point at the one bird that stays. Step 3: follow the chain from left to right.",
    transition: "So how can a farm protect its plants and keep nature? Adam."
  },
  {
    id: "s-ecofarm", presenter: "Adam", time: 80, level: "Medium",
    message: "The first protection is not a spray — it is diversity.",
    screen: "A satellite photo of the farm and the farmer's email typing itself. Then an illustrated ecosystem: aphids on a plant, ladybirds fly in from a hedge. Then a five-step ladder.",
    say: [
      "Family EcoFarm Number 5 is near Galanta: almost four hectares, a former vineyard. It is off-grid: solar panels, groundwater, drip irrigation. We wrote to the farmer, Jozef Vince, and he answered the same evening. This is why they farm organically. [Read the quote.]",
      "So how do you protect plants without strong chemistry? Here is a plant with aphids — small insects that suck plant sap. A colony grows very fast.",
      "Now watch the hedge. Ladybirds and lacewings live there. They fly to the plant and eat the aphids. That's why he keeps trees, shrubs and — in his words — “a little wilderness”.",
      "His order of protection: first diversity, then crop rotation, soil care and barriers. Products allowed in organic farming come last — only if necessary. The Ministry's analysis says the same for the whole country: more diverse crops, fewer sprays."
    ],
    point: "Step 3: point at the hedge on the left, then follow the ladybirds. Step 4: point at rung 1 and rung 5.",
    transition: "Then something happened that was not in our plan. Sara."
  },
  {
    id: "s-coop", presenter: "Sara", time: 25, level: "Easy",
    message: "Our second field visit was not planned — and it surprised us.",
    screen: "Our photo in front of the farming cooperative in Senica. Weather icons appear. Then hoof prints walk across the bottom of the screen.",
    say: [
      "On the same day, after the composting plant, we also visited the farming cooperative in Senica. This visit was not planned.",
      "We expected them to talk about the weather: heat, drought, storms, frost.",
      "We heard something else."
    ],
    point: "Point at our photo. On step 3, point at the hoof prints.",
    transition: "But first — the weather."
  },
  {
    id: "s-adapt", presenter: "Sara", time: 40, level: "Easy",
    message: "Adaptation is not always high-tech: sometimes it means changing when you plant.",
    screen: "A landscape photo from the cooperative. A season calendar: the “sowing” bar moves earlier. Then the main sentence and what we were told.",
    say: [
      "They told us that they can often adapt to the weather.",
      "For example, when the spring is warm and dry, they can sow earlier. This calendar is only an illustration — not their real dates.",
      "So adaptation is not always high-tech. Sometimes it simply means changing when you plant. This is what they told us — their experience, not a rule for every farm."
    ],
    point: "Step 2: point at the sowing bar moving to the left.",
    transition: "But there is one problem they cannot plan around. Dominik."
  },
  {
    id: "s-wildlife", presenter: "Dominik", time: 90, level: "Advanced",
    message: "Agriculture needs biodiversity — and also feels pressure from wildlife. Reality is local.",
    screen: "The cooperative's photo of a rapeseed field: grazed in front, blooming behind, with labels. Then four of their photos of damaged crops. Then a web of needs. Then the main message.",
    say: [
      "This is the cooperative's own photo. In the background, the rapeseed is in bloom. In front, it is grazed — the flowers are gone. Their caption says: “Fallow deer like the flowers too.”",
      "They shared more photos. Sorghum eaten by fallow deer. Rapeseed after red deer. Maize after wild boar. Sorghum after red deer — at harvest time. Wildlife eating and damaging crops was one of the biggest problems they described. They gave us no numbers, so we show none.",
      "But wildlife is not the enemy. It is a conflict of needs. The farm must harvest. Animals need food and cover — woods and hedges, the same shelter we wanted for the partridge. And what is eaten cannot be sold.",
      "So reality is local — not only “climate change, bad weather, lower harvest”. They adapt to the weather. Wildlife is much harder. Agriculture needs biodiversity, and it also feels pressure from wildlife. How do we protect crops without treating wildlife as the enemy?"
    ],
    point: "Step 1: point at the yellow band, then the grazed front. Step 2: click a photo to open it. Step 3: point at the centre of the web.",
    transition: "Now we follow the food. Karolína."
  },
  {
    id: "s-foodwaste", presenter: "Karolína", time: 50, level: "Easy",
    message: "Food becomes bio-waste — in Senica, 3,327 tonnes in 2025.",
    screen: "A tomato turns into a meal, scraps and a brown bin, then a waste stream. Then the amounts the Senica plant took in during 2025. Then an EU stamp.",
    say: [
      "From the field, food comes to our plates. And part of it becomes waste: scraps go into the brown bio-waste bin.",
      "In 2025 the composting plant in Senica took in 3,327 tonnes of bio-waste: 2,685 tonnes from gardens and parks, and 642 tonnes from kitchens and canteens. It is built for 4,200 tonnes a year. These numbers come directly from the operator.",
      "Since the end of 2023, EU law says bio-waste must be collected separately. That is why we have the brown bin."
    ],
    point: "Step 2: point at the two colours in the bar.",
    transition: "We went to see where this waste goes. Sara."
  },
  {
    id: "s-fieldreport", presenter: "Sara", time: 50, level: "Easy",
    message: "Our field report: we went there — and we label how sure we are about everything we show.",
    screen: "Our photo at the composting plant with a “Field report” stamp. Then our photos as prints and our short video. Then a legend with four symbols.",
    say: [
      "On the 30th of September at nine o'clock, the four of us visited the Senica composting plant. It is run by the town's technical services.",
      "This is our field notebook: fifteen photos, short clips and one video — all from our visit.",
      "From now on we label what we show. A full dot: the operator confirmed it in writing. A ring: you can see it in our photo. A dotted ring: our interpretation. A question mark: we don't know yet. You should always know how sure we are."
    ],
    point: "Step 1: point at the stamp. Step 3: point at each symbol.",
    transition: "Adam takes you through the plant — station by station."
  },
  {
    id: "s-load1", presenter: "Adam", time: 85, level: "Advanced",
    message: "Arrive, check, store, prepare — what the operator wrote, matched with what we saw.",
    screen: "A rail with eight stations at the top. Our photos: the yard, a pile of branches, a red machine and a look inside it, a blue shredder — with labels.",
    say: [
      "We follow one load. Station one: it arrives — garden waste in trucks or with residents, kitchen waste in a special vehicle. Station two: every load is weighed, checked by eye and written down. We have no photo of this step — this is what the operator wrote.",
      "Station three: the loads wait in the yard. These are branches — woody garden waste. Next, they are chipped and crushed. That's our guide on the right; he explained every station.",
      "Station four: preparation. The operator has a cutting-and-mixing machine. We think it's this red one — our interpretation, so a dotted ring. Inside: dark, finely cut material. And this light piece — plastic or paper? We honestly can't tell.",
      "Kitchen waste is shredded and mixed with green waste: two parts kitchen waste, one part green. This blue machine is a shredder — but which waste it shreds, we don't know. So we don't guess."
    ],
    point: "At every step point at the moving dot on the rail. Step 3: point at the question mark in the small photo.",
    transition: "Then it gets hot. Dominik."
  },
  {
    id: "s-load2", presenter: "Dominik", time: 85, level: "Advanced",
    message: "Compost is a managed process: heat, air, moisture, time and checks.",
    screen: "A thermometer rises to 70 °C. Our photos of windrows and the turner, with labels and zooms. A temperature chart. Then managed vs unmanaged compost.",
    say: [
      "Station five, only for kitchen waste: hygienisation. The mix is heated in a closed container — at least 70 degrees for at least one hour. This kills germs.",
      "Station six: composting. The material is shaped into long piles — windrows. Inside, microbes heat them to 45–70 degrees. And look closer: small plastic pieces, even inside the compost.",
      "This is the turner. It drives over the windrow and turns it — that brings air in. The rotor with paddles lifts and mixes the material. We think a tractor drives it — that's our interpretation.",
      "This chart is an illustration, not measured data. The operator wrote that they check temperature and moisture, and turn the windrow when the temperature changes. After three to five months, it is compost.",
      "So compost is not just rotting waste. It is managed: heat, air, moisture, time and checks. Mr Vince said it in one sentence: [read the quote]."
    ],
    point: "Step 1: the 70° line. Step 2: the zoom on the plastic. Step 3: the rotor zoom. Step 4: the triangles “turned”.",
    transition: "And at the end of the process? Sara."
  },
  {
    id: "s-load3", presenter: "Sara", time: 65, level: "Medium",
    message: "Screened, checked and back to Senica's gardens: 650–800 t of compost a year. Where did the rest go?",
    screen: "An illustration of a drum screen: fine compost falls through, rejects go out. Then 650–800 t of compost going to gardens and parks. Then the question: where did the rest go?",
    say: [
      "Station seven: the finished compost goes through a screen — a giant sieve. Fine compost falls through. What cannot become compost goes out at the end, to an authorised company. The quality is checked against a Slovak standard.",
      "Station eight: back to people. Every year the plant makes 650 to 800 tonnes of compost — for gardens in Senica and for the town's parks and flower beds.",
      "But 3,327 tonnes went in, and 650 to 800 come out. Where did the rest go? Our interpretation: most of it leaves as water and carbon dioxide — microbes break the material down and the heat dries it. Plus the rejects. That is our next question for the operator."
    ],
    point: "Step 1: point at the pieces falling into the rejects box. Step 3: point at the two numbers.",
    transition: "Now back to our very first photo. Karolína."
  },
  {
    id: "s-never", presenter: "Karolína", time: 80, level: "Medium",
    message: "The food can go back to soil. The plastic never can — sorting at home decides.",
    screen: "Our first photo again, with zooms on plastic bags. “Yes” for the food, “Never” for the plastic. The operator's list. A chain of consequences. The final sentence.",
    say: [
      "Remember our first photo? So — can this go back to soil?",
      "Look at the bags. Many are closed, with food still inside.",
      "The food: yes, it can become compost. The plastic: never — it must be taken out. The operator listed what they find in bio-waste: stones, soil, plastic, textile, mixed rubbish, metal — and branches that are not prepared as instructed.",
      "One wrong item means extra work and more rejects — and what the screen misses can end up in gardens. We saw plastic pieces even in the compost piles. And in Horné Jatovo, a biogas plant reported that up to 12 percent of its bio-waste did not belong there.",
      "Plastic does not become soil. We asked the operator what people can do. The answer was short: don't put unwanted things in bio-waste."
    ],
    point: "Step 2: point at the zoomed bags. Step 4: follow the chain from left to right.",
    transition: "Composting is one way. Dominik shows the other."
  },
  {
    id: "s-split", presenter: "Dominik", time: 55, level: "Advanced",
    message: "Composting and biogas are not rivals: the right material for the right process.",
    screen: "Bio-waste splits into two paths — composting and anaerobic digestion — and both lead back to the soil. Icons travel along the paths.",
    say: [
      "There are two main ways to recover bio-waste. Composting works with air, heat and time — that's Senica. Anaerobic digestion works without air and makes biogas and digestate. Both can go back to the soil — if they are clean.",
      "According to the Slovak Biogas Association, woody material suits composting; liquid waste, animal by-products and oils suit biogas plants — and the two should cooperate. That is an industry view, so we say whose view it is.",
      "So it is not compost against biogas. The wrong material in the wrong process gives a worse result in both."
    ],
    point: "Follow the icons: branches go left, oil and slurry go right.",
    transition: "So how does a biogas plant work? Adam."
  },
  {
    id: "s-biogas3d", presenter: "Adam", time: 55, level: "Advanced",
    message: "A biogas plant is a warm stomach without oxygen: biogas out, digestate back to the fields.",
    screen: "A 3D cutaway of a digester that turns slowly; five steps light up on the left.",
    say: [
      "This is a simplified model, not a real plant. Bio-waste, manure or slurry goes in.",
      "Inside there is no oxygen. Bacteria break the material down. The tank is kept warm: 35 to 40 degrees, or 50 to 55.",
      "They produce biogas — mostly methane and CO2. It collects under the dome.",
      "An engine burns the gas to make electricity and heat — or the gas is cleaned into biomethane.",
      "What is left is digestate. It can go back to the fields as fertiliser. A biogas plant is like a warm stomach without oxygen."
    ],
    point: "Step 3: the bubbles. Step 5: the storage tank on the right.",
    transition: "Dominik closes the loop."
  },
  {
    id: "s-backtosoil", presenter: "Dominik", time: 60, level: "Advanced",
    message: "Sustainability is not a product. It is the quality of the whole system.",
    screen: "The soil from the opening rises again. Five lessons. The final sentence while a dot falls into the soil. Then a question for our hosts and a thank-you.",
    say: [
      "The loop closes here. Compost from Senica goes back to gardens and green areas in our town.",
      "What did we learn? A simple landscape loses water, soil and life. The first protection is diversity, not a spray. Farms adapt to the weather — wildlife is harder. Bio-waste is a resource only when it is clean. And every material needs the right process.",
      "So this is our conclusion. [Pause.] Sustainability is not a product. It is the quality of the whole system.",
      "(Karolína:) And now our question for you: what does this loop look like in Mersin? (All four:) Thank you — teşekkürler!"
    ],
    point: "Step 2: point at each lesson. Step 4: all four of you step forward; Karolína asks the question.",
    transition: "Questions? Press S to open Our research if someone asks about a source."
  },
  {
    id: "s-vertical", presenter: "Adam", time: 45, level: "Medium", backup: true,
    message: "Backup: vertical farms save water but need a lot of electricity.",
    screen: "A 9-layer vertical farm next to the 28 m² of solar panels it would need.",
    say: [
      "Only if someone asks: vertical farms. Water and nutrients go round in a closed system, there is no erosion and no weather.",
      "But plants need light, and LEDs need a lot of electricity. One square metre of land with nine layers would need about 28 square metres of solar panels. That's from a peer-reviewed review in Nature Food, 2021.",
      "Companies promote vertical farms strongly. We use the peer-reviewed numbers instead of their percentages."
    ],
    point: "Point at the 28 tiles.",
    transition: "Back to the questions."
  },
  {
    id: "s-governance", presenter: "Dominik", time: 50, level: "Advanced", backup: true,
    message: "Backup: when waste governance fails — separate what is documented from what is claimed.",
    screen: "Three cards: documented, alleged, under investigation. Two side notes.",
    say: [
      "Only if someone asks: a construction-waste site in Skalica, 20 kilometres from our school, reported in September 2026.",
      "Documented: the environmental inspectorate inspected the site in July 2026, and the inspection is not finished. The Slovak Land Fund reports damage to the environment on land it leases there.",
      "Other claims are disputed or under investigation — so we do not repeat them as facts.",
      "The bigger question: what happens to waste that cannot be reused or treated biologically? Bratislava is debating a planned incinerator."
    ],
    point: "Point at the three stamps: documented, alleged, under investigation.",
    transition: "Back to the questions."
  }
];
