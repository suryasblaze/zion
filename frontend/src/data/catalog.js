/**
 * Local mirror of db/seed_products.sql.
 *
 * The storefront prefers the live API. This is what it falls back to when
 * the API is unreachable, so `npm run dev` shows a complete, honest site
 * before Supabase is wired up. Once the backend is running, the API wins
 * and this is never read.
 */

export const TEAS = [
  {
    slug: 'butterfly-pea',
    taste: "Soft and faintly earthy, closer to a good green tea than to anything floral. Barely any aroma until the water hits it, then a clean grassy sweetness. Lemon sharpens it; honey rounds it out.",
    origin: "Grown in Tamil Nadu and gathered as whole blooms, not broken petals. Shade-dried so the pigment survives, then hand-sorted.",
    nutrition: ["0 kcal per 200 ml cup", "No caffeine, no sugar", "Anthocyanins — the pigments that make it blue", "No additives, colour or preservative"],
    love: ["It turns violet when you add lime, in front of you", "Caffeine free, so an evening cup costs you nothing", "Whole flowers, so it still smells of something", "The most striking thing you can hand a guest"],
    name: 'Butterfly Pea',
    script: 'Pea Tea',
    botanical: 'Clitoria ternatea',
    tagline: "Nature's blue elixir",
    cup: 'Indigo',
    accent: '#2B3F8C',
    accentDeep: '#23336F',
    image: '/products/butterfly-pea.jpg',
    tile: '/products/butterfly-pea-tile.jpg',
    price: 349,
    mrp: 399,
    brew: { temp: 90, minutes: 4 },
    short:
      'A vivid blue infusion of whole butterfly pea flowers. Turns violet the moment you add lime.',
    long:
      'Butterfly pea flowers give up their colour in about thirty seconds — a deep, unmistakable indigo used across South and Southeast Asia for centuries, as a dye and as a daily tonic. The flavour is soft and faintly earthy, closer to a fine green tea than to anything floral.',
    benefits: [
      ['Rich in antioxidants', 'Anthocyanins help the body handle free radicals.'],
      ['Supports eye health', 'Traditionally taken to improve vision and reduce strain.'],
      ['Enhances brain function', 'Long used to support memory, focus and clarity.'],
      ['Healthy skin support', 'Antioxidants that help promote collagen and a natural glow.'],
      ['Supports weight management', 'A calorie-free cup inside a balanced diet.'],
    ],
    sizes: [
      { sku: 'ZH-BP-100', label: '100 g', price: 349, mrp: 399 },
      { sku: 'ZH-BP-250', label: '250 g', price: 749, mrp: 899 },
    ],
  },
  {
    slug: 'hibiscus',
    taste: "Sharp and bright, like cranberry with the sugar taken out. Smells faintly of red berries and tamarind. The most assertive tea in the range, and the one that takes honey best.",
    origin: "Grown across Tamil Nadu and dried within hours of picking, which is why the colour comes out garnet rather than brown. Only the calyx is used, never the leaf.",
    nutrition: ["0 kcal per 200 ml cup", "No caffeine, no sugar", "Naturally high in Vitamin C", "Anthocyanins and organic acids from the calyx"],
    love: ["Brews a colour that does not look real", "The best of the six over ice", "Tart enough to drink without sugar", "Dried same-day, so it tastes clean rather than dusty"],
    name: 'Hibiscus',
    script: 'Herbal Tea',
    botanical: 'Hibiscus sabdariffa',
    tagline: "Heart's natural care",
    cup: 'Crimson',
    accent: '#9E1B32',
    accentDeep: '#85162A',
    image: '/products/hibiscus.jpg',
    tile: '/products/hibiscus-tile.jpg',
    price: 299,
    mrp: 349,
    brew: { temp: 95, minutes: 5 },
    short:
      'Hand-picked hibiscus calyces. Deep crimson, bright and tart, and very good over ice.',
    long:
      'Hibiscus brews the colour of garnet and tastes like cranberry with the sugar taken out — sharp, clean, genuinely refreshing. The difference between good and ordinary is when the calyx is picked and how fast it is dried. Ours are dried within hours of harvest.',
    benefits: [
      ['Rich in antioxidants', 'Helps fight free radicals and supports immunity.'],
      ['Supports heart health', 'Traditionally taken to help maintain healthy blood pressure.'],
      ['Aids weight management', 'Supports metabolism and a healthy weight.'],
      ['Refreshes and relieves stress', 'Natural calming properties that help you unwind.'],
      ['Supports immunity', 'Packed with Vitamin C.'],
    ],
    sizes: [
      { sku: 'ZH-HB-100', label: '100 g', price: 299, mrp: 349 },
      { sku: 'ZH-HB-250', label: '250 g', price: 649, mrp: 799 },
    ],
  },
  {
    slug: 'chamomile',
    taste: "Honeyed and apple-sweet, with a warm hay aroma that arrives the moment you pour. Rounded and gentle. No bitterness at all if you keep to five minutes.",
    origin: "Whole flower heads, never milled. Chamomile's aromatic oils sit in the yellow disc at the centre of the flower and escape within days of grinding.",
    nutrition: ["0 kcal per 200 ml cup", "No caffeine, no sugar", "Apigenin — the compound chamomile is known for", "Whole flower heads, not dust"],
    love: ["You can see the individual flowers in the tin", "The easiest of the six to get right", "The cup for the last hour of the evening", "Gentle enough for every day"],
    name: 'Chamomile',
    script: 'Herbal Tea',
    botanical: 'Matricaria chamomilla',
    tagline: "Nature's calm in every sip",
    cup: 'Amber',
    accent: '#D9A21B',
    accentDeep: '#8A6408',
    image: '/products/chamomile.jpg',
    tile: '/products/chamomile-tile.jpg',
    price: 399,
    mrp: 449,
    brew: { temp: 90, minutes: 5 },
    short:
      'Whole chamomile flower heads. Soft, honeyed, and the most forgiving tea to brew.',
    long:
      'We buy whole flower heads and never mill them. Chamomile’s aromatic oils sit in the yellow disc at the centre of the flower and escape within days of grinding — which is why most chamomile tastes of very little. You can still see individual flowers in this tin.',
    benefits: [
      ['Relieves stress and anxiety', 'Helps calm the mind and promote relaxation.'],
      ['Promotes better sleep', 'Supports restful sleep and improves sleep quality.'],
      ['Supports digestion', 'Soothes the gut and helps relieve bloating.'],
      ['Healthy skin support', 'Antioxidants that promote clear, healthy skin.'],
      ['Boosts immunity', 'Strengthens the body’s natural defences.'],
    ],
    sizes: [
      { sku: 'ZH-CM-100', label: '100 g', price: 399, mrp: 449 },
      { sku: 'ZH-CM-250', label: '250 g', price: 899, mrp: 1049 },
    ],
  },
  {
    slug: 'lavender',
    taste: "Floral and clean, slightly sweet, with a cool minty finish. Smells like a summer field rather than soap, which is entirely a matter of how briefly you brew it.",
    origin: "The one botanical we do not source from Tamil Nadu. Culinary-grade Lavandula angustifolia needs altitude and a dry summer, so ours comes from the hills.",
    nutrition: ["0 kcal per 200 ml cup", "No caffeine, no sugar", "Linalool and linalyl acetate — the calming aromatics", "Culinary grade, not cosmetic"],
    love: ["Culinary grade, so it never tastes like perfume", "Three minutes and it is perfect; four and it is not", "Pairs with honey and lemon better than anything here", "The one to reach for after a loud day"],
    name: 'Lavender',
    script: 'Herbal Infusion',
    botanical: 'Lavandula angustifolia',
    tagline: 'Calm mind, peaceful you',
    cup: 'Violet',
    accent: '#6B4E9B',
    accentDeep: '#574080',
    image: '/products/lavender.jpg',
    tile: '/products/lavender-tile.jpg',
    price: 449,
    mrp: 529,
    brew: { temp: 85, minutes: 3 },
    short:
      'Culinary-grade lavender buds. Floral and clean, with none of the soapiness of the cheap stuff.',
    long:
      'Lavender divides people, almost always because they have had a bad one. Brewed briefly and lightly, culinary-grade Lavandula angustifolia tastes like a summer field. The trick is restraint: half the leaf and half the time you would give anything else here.',
    benefits: [
      ['Relieves stress and anxiety', 'Calms the mind and promotes a sense of ease.'],
      ['Promotes better sleep', 'Supports restful sleep naturally.'],
      ['Supports digestion', 'Helps soothe the digestive system.'],
      ['Healthy skin support', 'Rich in antioxidants.'],
      ['Boosts immunity', 'Supports the body’s natural defences.'],
    ],
    sizes: [
      { sku: 'ZH-LV-100', label: '100 g', price: 449, mrp: 529 },
      { sku: 'ZH-LV-250', label: '250 g', price: 999, mrp: 1199 },
    ],
  },
  {
    slug: 'nannari',
    taste: "Woody and faintly vanilla-sweet, with a long cooling finish. The aroma is unmistakable if you grew up here: sarsaparilla, root beer, summer afternoons.",
    origin: "Hemidesmus indicus root, gathered in Tamil Nadu and cut coarse rather than powdered. Finely milled nannari loses its aroma and gives a muddy cup.",
    nutrition: ["0 kcal per 200 ml cup", "No caffeine, no sugar", "Coumarins — which give the sarsaparilla aroma", "Coarse-cut root, not powder"],
    love: ["The nannari sherbet you remember, in a tin", "A genuine body coolant, not a marketing line", "Rooted in Siddha practice, not invented for a label", "Brews strong enough to sweeten with jaggery and ice"],
    name: 'Nannari',
    script: 'Herbal Tea',
    botanical: 'Hemidesmus indicus',
    tagline: 'Rooted in tradition',
    cup: 'Russet',
    accent: '#8A4B24',
    accentDeep: '#743E1E',
    image: '/products/nannari.jpg',
    tile: '/products/nannari-tile.jpg',
    price: 279,
    mrp: 329,
    brew: { temp: 100, minutes: 8 },
    tamil: 'நன்னாரி',
    short:
      'Indian sarsaparilla root. The body coolant every Tamil household already knows.',
    long:
      'If you grew up in Tamil Nadu you have had nannari, most likely as sherbet on a hot afternoon. As a tea it is woody and faintly vanilla-sweet, with the cooling finish that made it a summer staple long before anyone called it wellness.',
    benefits: [
      ['Natural body coolant', 'Helps cool the body and reduce heat stress.'],
      ['Supports digestion', 'Aids digestion and relieves bloating.'],
      ['Healthy skin support', 'Helps detoxify and promote clear skin.'],
      ['Boosts immunity', 'Strengthens the immune system.'],
      ['Relieves stress', 'Calms the mind and supports mental wellbeing.'],
    ],
    sizes: [
      { sku: 'ZH-NN-100', label: '100 g', price: 279, mrp: 329 },
      { sku: 'ZH-NN-250', label: '250 g', price: 599, mrp: 729 },
    ],
  },
  {
    slug: 'aavaram-poo',
    taste: "Mild and lightly sweet, a little grassy, with no bitterness whatsoever. Faint honey aroma. The easiest tea here to drink several cups of in a day.",
    origin: "Senna auriculata grows as scrub across the drier districts of Tamil Nadu and flowers bright yellow most of the year. Dried whole and hand-sorted, never shredded.",
    nutrition: ["0 kcal per 200 ml cup", "No caffeine, no sugar", "Flavonoids and polyphenols from the whole flower", "Hand-sorted, single botanical"],
    love: ["Cherished in Siddha medicine for generations", "Clear gold in the cup, never cloudy", "Mild enough for several cups a day", "Rarely sold outside Tamil Nadu at this standard"],
    name: 'Aavaram Poo',
    script: 'Herbal Tea',
    botanical: 'Senna auriculata',
    tagline: 'Golden bloom wellness',
    cup: 'Marigold',
    accent: '#E0B01F',
    accentDeep: '#8C6D0C',
    image: '/products/aavaram-poo.jpg',
    tile: '/products/aavaram-poo-tile.jpg',
    price: 299,
    mrp: 349,
    brew: { temp: 95, minutes: 6 },
    tamil: 'ஆவாரம் பூ',
    short:
      "Tanner's cassia flowers. Mild, golden, and cherished in Siddha medicine for generations.",
    long:
      'Senna auriculata grows as scrub across the drier districts of Tamil Nadu and flowers bright yellow most of the year. Siddha practitioners have used aavaram poo for a very long time, particularly around blood sugar and skin. We dry the flowers whole and sort them by hand.',
    benefits: [
      ['Supports blood sugar balance', 'Traditionally used to help maintain healthy levels.'],
      ['Natural detoxifier', 'Helps purify the blood and supports liver health.'],
      ['Improves digestion', 'Aids digestion and relieves constipation.'],
      ['Healthy skin support', 'Antioxidants for clear, glowing skin.'],
      ['Boosts immunity', 'Supports the body against infection.'],
    ],
    sizes: [
      { sku: 'ZH-AP-100', label: '100 g', price: 299, mrp: 349 },
      { sku: 'ZH-AP-250', label: '250 g', price: 649, mrp: 799 },
    ],
  },
]

export const SETS = [
  {
    slug: 'the-six-discovery-box',
    taste: "Six different cups, from the sharp tartness of hibiscus to the woody sweetness of nannari. The point is the contrast: you will know which two are yours by the end of the week.",
    origin: "All six botanicals, each from its own source, packed together in our unit in Tamil Nadu. The brewing card is printed with the tested temperature and time for each.",
    nutrition: ["0 kcal per 200 ml cup", "No caffeine in any of the six", "50 g of each of the six", "Around ten cups per tea, sixty in total"],
    love: ["The honest way to find your one, rather than guessing", "Around sixty cups for less than buying two tins", "Brewing card included, so nothing is wasted", "Ships gift-ready, with no pricing inside"],
    name: 'The Six Discovery Box',
    script: 'Discovery Box',
    tagline: 'Six nature, one wellness',
    accent: '#8F7222',
    accentDeep: '#6E570F',
    image: '/brand/range-poster-light.jpg',
    tile: '/products/set-six-tile.jpg',
    price: 1499,
    mrp: 1899,
    isSet: true,
    short: 'All six infusions, 50 g of each. About sixty cups.',
    long:
      'Nobody should have to guess which herbal tea suits them from a product page. Fifty grams of each is roughly ten cups apiece — enough to drink each one properly, at different times of day, and work out which two you actually want to keep buying.',
    contents: ['Butterfly pea', 'Hibiscus', 'Chamomile', 'Lavender', 'Nannari', 'Aavaram poo'],
    sizes: [{ sku: 'ZH-SET-SIX', label: '6 × 50 g', price: 1499, mrp: 1899 }],
  },
  {
    slug: 'the-calm-trio',
    taste: "Three quiet cups. Chamomile honeyed and soft, lavender floral and cool, butterfly pea clean and faintly grassy. Nothing here is sharp.",
    origin: "Chamomile and butterfly pea from Tamil Nadu, lavender from the hills. Packed together in the presentation sleeve.",
    nutrition: ["0 kcal per 200 ml cup", "No caffeine in any of the three", "100 g each of three teas"],
    love: ["Chosen for one job: the last hour of the day", "Nothing in the box will keep you awake", "100 g of each, so it lasts", "The set people buy after their first chamomile"],
    name: 'The Calm Trio',
    script: 'Evening Set',
    tagline: 'For the last hour of the day',
    accent: '#6B4E9B',
    accentDeep: '#574080',
    image: '/brand/range-poster-dark.jpg',
    tile: '/products/set-calm-tile.jpg',
    price: 1099,
    mrp: 1297,
    isSet: true,
    short: 'Chamomile, lavender and butterfly pea — the three that wind the day down.',
    long:
      'Three teas chosen for one job. Chamomile for the hour before bed, lavender when the day has been loud, butterfly pea for the evening you still want to feel clear-headed.',
    contents: ['Chamomile 100 g', 'Lavender 100 g', 'Butterfly pea 100 g'],
    sizes: [{ sku: 'ZH-SET-CALM', label: '3 × 100 g', price: 1099, mrp: 1297 }],
  },
]

export const PRODUCTS = [...TEAS, ...SETS]

export const FAQS = [
  {
    q: 'Are ZION herbal teas caffeine free?',
    a: 'All six, completely. There is no Camellia sinensis in any tin — nothing that black, green or oolong tea is made from — so there is no caffeine at any stage. You can drink them at eleven at night.',
  },
  {
    q: 'Why does butterfly pea tea turn purple?',
    a: 'Anthocyanins, the same pigments that colour blueberries, shift with acidity. Add lime and the cup goes from indigo to violet in about five seconds. It is chemistry, not a dye.',
  },
  {
    q: 'What is aavaram poo used for?',
    a: 'Aavaram poo is the flower of Senna auriculata. In Siddha medicine it has been used for generations to support blood sugar balance, digestion and skin health. Brewed, it is mild, clear gold and slightly sweet.',
  },
  {
    q: 'What is nannari?',
    a: 'Nannari is the root of Hemidesmus indicus, Indian sarsaparilla — a traditional Tamil body coolant, most familiar as the sherbet drunk in summer. As a tea it is woody and faintly vanilla-sweet.',
  },
  {
    q: 'How many cups do I get in a 100 g pack?',
    a: 'Roughly 40 to 50. Flowers are light, so chamomile and butterfly pea go furthest; nannari root is dense and gives fewer, stronger cups. A heaped teaspoon per 200 ml is the standard measure.',
  },
  {
    q: 'Do you ship across India?',
    a: 'Yes, to every serviceable pincode, from our unit in Tamil Nadu. Delivery is free over ₹999 and ₹69 below that. Chennai, Coimbatore, Madurai, Tiruchirappalli and Salem usually take two to three working days.',
  },
  {
    q: 'Are these safe during pregnancy or with medication?',
    a: 'Herbal infusions are food, not medicine, and we make no medical claims. Some botanicals — hibiscus and senna-family herbs in particular — are not usually recommended in pregnancy, and some interact with medication. Ask your doctor first.',
  },
  {
    q: 'Can I order on WhatsApp instead?',
    a: 'Yes. Message +91 63840 13131 with what you want and a delivery pincode. Checkout is faster, but plenty of our customers prefer WhatsApp and that is entirely fine.',
  },
]

export const bySlug = (slug) => PRODUCTS.find((p) => p.slug === slug)
