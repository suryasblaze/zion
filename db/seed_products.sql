-- =====================================================================
-- ZION Herbs -- seed_products.sql
-- Eight products: the six single-origin infusions from the brand
-- artwork, plus two curated sets. Copy follows the packaging.
-- Re-runnable: keyed on slug.
-- =====================================================================

insert into products (
  category_id, name, slug, script_word, botanical_name, tagline,
  short_desc, description, story,
  accent_color, accent_soft, hero_image,
  benefits, ingredients, brewing, badges, seo,
  is_featured, sort_order
)
select c.id, v.name, v.slug, v.script_word, v.botanical_name, v.tagline,
       v.short_desc, v.description, v.story, v.accent_color, v.accent_soft,
       v.hero_image, v.benefits::jsonb, v.ingredients::jsonb, v.brewing::jsonb,
       v.badges::jsonb, v.seo::jsonb, v.is_featured, v.sort_order
  from (values

-- ============================================== 1. BUTTERFLY PEA =====
('Butterfly Pea', 'butterfly-pea', 'Pea Tea', 'Clitoria ternatea',
 'Nature''s blue elixir',
 'A vivid blue infusion of whole butterfly pea flowers. Turns violet the moment you add lime.',
 'Butterfly pea flowers give up their colour in about thirty seconds — a deep, unmistakable indigo that has been used across South and Southeast Asia for centuries, both as a dye and as a daily tonic. The flavour is soft and faintly earthy, closer to a fine green tea than to anything floral. It takes lemon or honey beautifully, and a squeeze of lime will swing the whole cup from blue to violet in front of you.',
 'The colour is not a gimmick, it is the active part. The pigments that make butterfly pea blue are anthocyanins — the same family of compounds that make blueberries and red cabbage worth eating. We buy whole flowers rather than broken petals, because whole flowers hold their pigment and their aroma far longer in storage.',
 '#2B3F8C', '#4A63BE', '/products/butterfly-pea.jpg',
 '[{"title":"Rich in antioxidants","body":"Anthocyanins help the body handle free radicals and support everyday wellness."},
   {"title":"Supports eye health","body":"Traditionally taken to improve vision and reduce eye strain."},
   {"title":"Enhances brain function","body":"Long used to support memory, focus and mental clarity."},
   {"title":"Healthy skin support","body":"Antioxidants that help promote collagen and a natural glow."},
   {"title":"Supports weight management","body":"A calorie-free cup that sits well inside a balanced diet."}]',
 '["Whole dried butterfly pea flowers (Clitoria ternatea), 100%"]',
 '{"temp_c":90,"minutes":4,"steps":[
    "Use one heaped teaspoon of flowers per 200 ml cup.",
    "Pour water just off the boil and cover.",
    "Steep four minutes — the colour arrives long before the flavour does.",
    "Strain. Add lime if you want it violet, honey if you want it sweet."],
   "iced":"Brew double strength, cool, pour over ice with lime."}',
 '["Caffeine free","100% natural","No artificial colour","Whole flower"]',
 '{"title":"Butterfly Pea Flower Tea — Natural Blue, Caffeine Free | ZION Herbs",
   "description":"Whole butterfly pea flowers from Tamil Nadu. Naturally blue, caffeine free, rich in antioxidants. Turns violet with lime. Free delivery over ₹999.",
   "keywords":["butterfly pea flower tea","blue tea","clitoria ternatea","caffeine free tea india","natural blue tea"]}',
 true, 1),

-- ============================================== 2. HIBISCUS =========
('Hibiscus', 'hibiscus', 'Herbal Tea', 'Hibiscus sabdariffa',
 'Heart''s natural care',
 'Hand-picked hibiscus calyces. Deep crimson, bright and tart, and very good over ice.',
 'Hibiscus brews the colour of garnet and tastes like cranberry with the sugar taken out — sharp, clean, and genuinely refreshing rather than merely pleasant. It is the most assertive tea in the range. Serve it hot with a little honey, or brew it strong, chill it, and drink it through a summer afternoon.',
 'Hibiscus is grown widely across Tamil Nadu, and the difference between good and ordinary comes down to when the calyx is picked and how fast it is dried. We use calyces dried within hours of harvest, which is why the colour comes out this deep and the tartness stays clean instead of turning dusty.',
 '#9E1B32', '#C93B55', '/products/hibiscus.jpg',
 '[{"title":"Rich in antioxidants","body":"Helps fight free radicals and supports overall health and immunity."},
   {"title":"Supports heart health","body":"Traditionally taken to help maintain healthy blood pressure and heart function."},
   {"title":"Aids natural weight management","body":"Supports metabolism and helps maintain a healthy weight."},
   {"title":"Refreshes mind and relieves stress","body":"Natural calming properties that help reduce stress and promote relaxation."},
   {"title":"Supports immunity","body":"Packed with Vitamin C and natural compounds that strengthen immunity."}]',
 '["Hand-picked dried hibiscus calyces (Hibiscus sabdariffa), 100%"]',
 '{"temp_c":95,"minutes":5,"steps":[
    "One heaped teaspoon per 200 ml.",
    "Pour boiling water over and cover.",
    "Five minutes for a bright cup, seven for a deeper, more tannic one.",
    "Strain. Honey rounds off the tartness if you prefer it softer."],
   "iced":"Brew double strength, chill, serve over ice with mint."}',
 '["Caffeine free","100% natural","Hand-picked","Vitamin C rich"]',
 '{"title":"Hibiscus Tea — Pure Dried Hibiscus Flowers, Caffeine Free | ZION Herbs",
   "description":"Hand-picked hibiscus calyces from Tamil Nadu. Naturally tart, rich in Vitamin C, supports heart health. Caffeine free with no additives.",
   "keywords":["hibiscus tea","dried hibiscus flowers","hibiscus tea for blood pressure","caffeine free herbal tea","hibiscus tea india"]}',
 true, 2),

-- ============================================== 3. CHAMOMILE ========
('Chamomile', 'chamomile', 'Herbal Tea', 'Matricaria chamomilla',
 'Nature''s calm in every sip',
 'Whole chamomile flower heads. Soft, honeyed, and the most forgiving tea to brew.',
 'Chamomile is the one everybody already trusts, which makes the quality difference obvious the moment you taste a good one. Whole flower heads give a rounded, honey-apple sweetness. The dust and broken petals that fill most teabags give you bitterness instead. This is the cup for the last hour of the evening.',
 'We buy whole flower heads and never mill them, because chamomile''s aromatic oils sit in the yellow disc at the centre of the flower and escape within days of grinding. If you look at the leaf in this tin you can still see individual flowers, which is exactly the point.',
 '#D9A21B', '#EFC65A', '/products/chamomile.jpg',
 '[{"title":"Relieves stress and anxiety","body":"Helps calm the mind, reduce stress and promote relaxation."},
   {"title":"Promotes better sleep","body":"Naturally supports restful sleep and helps improve sleep quality."},
   {"title":"Supports digestion","body":"Soothes the digestive system, helps relieve bloating and supports gut health."},
   {"title":"Healthy skin support","body":"Rich in antioxidants that help fight free radicals and promote clear, healthy skin."},
   {"title":"Boosts immunity","body":"Strengthens the immune system and helps the body protect against infection."}]',
 '["Whole dried chamomile flower heads (Matricaria chamomilla), 100%"]',
 '{"temp_c":90,"minutes":5,"steps":[
    "One heaped teaspoon of whole flowers per 200 ml.",
    "Water just off the boil, then cover the cup — the aroma is the point and it leaves with the steam.",
    "Five minutes.",
    "Strain and drink. Best about an hour before bed."],
   "iced":"Not recommended. Chamomile is at its best hot."}',
 '["Caffeine free","100% natural","Whole flower","Gentle and soothing"]',
 '{"title":"Chamomile Tea — Whole Flower, for Sleep and Calm | ZION Herbs",
   "description":"Whole chamomile flower heads, never milled. Caffeine free, naturally calming, supports restful sleep and digestion. Hand-packed in Tamil Nadu.",
   "keywords":["chamomile tea","chamomile tea for sleep","whole flower chamomile","caffeine free tea","calming herbal tea india"]}',
 true, 3),

-- ============================================== 4. LAVENDER =========
('Lavender', 'lavender', 'Herbal Infusion', 'Lavandula angustifolia',
 'Calm mind, peaceful you',
 'Culinary-grade lavender buds. Floral and clean, with none of the soapiness of the cheap stuff.',
 'Lavender divides people, and almost always because they have had a bad one. Cheap lavender tastes like perfume. Culinary-grade Lavandula angustifolia, brewed lightly and briefly, tastes like a summer field — floral, slightly sweet, faintly minty at the finish. The trick is restraint: half the leaf and half the time you would use for any other herb.',
 'This is the only botanical in the range we do not source from Tamil Nadu — good culinary lavender needs altitude and a dry summer, so ours comes from the hills. Everything else about it, from the sorting to the packing, happens in our own unit.',
 '#6B4E9B', '#8E6FC4', '/products/lavender.jpg',
 '[{"title":"Relieves stress and anxiety","body":"Lavender helps calm the mind, reduce stress and promote a sense of relaxation."},
   {"title":"Promotes better sleep","body":"Naturally supports restful sleep and helps improve sleep quality."},
   {"title":"Supports digestion","body":"Helps soothe the digestive system and relieve bloating and discomfort."},
   {"title":"Healthy skin support","body":"Rich in antioxidants that help fight free radicals and promote clear, healthy skin."},
   {"title":"Boosts immunity","body":"Strengthens the immune system and helps the body protect against infection."}]',
 '["Culinary-grade dried lavender buds (Lavandula angustifolia), 100%"]',
 '{"temp_c":85,"minutes":3,"steps":[
    "Half a teaspoon per 200 ml — lavender needs less leaf than anything else here.",
    "Water at 85°C, not boiling.",
    "Three minutes only. Longer turns it bitter and soapy.",
    "Strain immediately."],
   "iced":"Brew, cool, and add to sparkling water with a strip of lemon peel."}',
 '["Caffeine free","Culinary grade","Sourced from premium lavender","Pure and refreshing"]',
 '{"title":"Lavender Tea — Culinary Grade Buds for Sleep and Calm | ZION Herbs",
   "description":"Culinary-grade lavender buds, floral and clean, never soapy. Caffeine free, supports restful sleep and calm. Hand-packed in Tamil Nadu.",
   "keywords":["lavender tea","culinary lavender","lavender tea for sleep","caffeine free floral tea","lavender infusion india"]}',
 true, 4),

-- ============================================== 5. NANNARI ==========
('Nannari', 'nannari', 'Herbal Tea', 'Hemidesmus indicus',
 'Rooted in tradition',
 'Indian sarsaparilla root. The body coolant every Tamil household already knows.',
 'If you grew up anywhere in Tamil Nadu you have had nannari, most likely as sherbet on a hot afternoon. As a tea it is something else again — woody, faintly vanilla-sweet, with the cooling finish that made it a summer staple long before anyone called it wellness. This is the most quietly distinctive cup in the range.',
 'Nannari root — Hemidesmus indicus, Indian sarsaparilla — has a long history in Siddha medicine as a natural body coolant, and it is still made into sherbet in homes across the state every summer. We source clean, well-dried root and cut it coarse, because finely powdered nannari loses its aroma and gives a muddy cup.',
 '#8A4B24', '#B76F42', '/products/nannari.jpg',
 '[{"title":"Natural body coolant","body":"Helps cool the body, reduce heat stress and maintain body balance."},
   {"title":"Supports digestion","body":"Aids digestion, relieves bloating and helps maintain a healthy gut naturally."},
   {"title":"Healthy skin support","body":"Rich in antioxidants that help detoxify the body and promote clear, healthy skin."},
   {"title":"Boosts immunity","body":"Strengthens the immune system and helps the body fight against infection."},
   {"title":"Relieves stress and promotes relaxation","body":"Naturally calms the mind, reduces stress and supports better mental wellbeing."}]',
 '["Dried nannari root, coarse cut (Hemidesmus indicus), 100%"]',
 '{"temp_c":100,"minutes":8,"steps":[
    "One heaped teaspoon of cut root per 200 ml.",
    "Root needs a full boil and real time — this is not a delicate flower.",
    "Simmer or steep covered for eight to ten minutes.",
    "Strain. Traditionally taken with a little jaggery or lime."],
   "iced":"Brew strong, sweeten with jaggery syrup, chill, and serve over ice with lime — nannari sherbet."}',
 '["Caffeine free","100% natural","Natural detoxifier","Rooted in Siddha tradition"]',
 '{"title":"Nannari Tea — Indian Sarsaparilla Root, Natural Body Coolant | ZION Herbs",
   "description":"Dried nannari root (Hemidesmus indicus), the traditional Tamil body coolant. Caffeine free, aids digestion, naturally detoxifying.",
   "keywords":["nannari tea","nannari root","indian sarsaparilla","hemidesmus indicus","body coolant tea","siddha herbal tea","nannari sherbet"]}',
 true, 5),

-- ============================================== 6. AAVARAM POO ======
('Aavaram Poo', 'aavaram-poo', 'Herbal Tea', 'Senna auriculata',
 'Golden bloom wellness',
 'Tanner''s cassia flowers. Mild, golden, and cherished in Siddha medicine for generations.',
 'Aavaram poo brews a clear gold and tastes gentler than it looks — mildly sweet, a little grassy, with no bitterness at all. In Tamil households it has been used for generations, in medicine and in skincare both. It is the easiest tea here to drink several cups of in a day.',
 'Senna auriculata grows as scrub across the drier districts of Tamil Nadu and flowers bright yellow through most of the year. Siddha practitioners have used aavaram poo for a very long time, particularly in the context of blood sugar balance and skin health. We dry the flowers whole and sort them by hand.',
 '#E0B01F', '#F2CB55', '/products/aavaram-poo.jpg',
 '[{"title":"Supports blood sugar balance","body":"Traditionally known to help maintain healthy blood sugar levels."},
   {"title":"Natural detoxifier","body":"Helps purify the blood and supports liver health naturally."},
   {"title":"Improves digestion","body":"Aids digestion and helps relieve bloating and constipation."},
   {"title":"Healthy skin support","body":"Rich in antioxidants that help promote clear, healthy and glowing skin."},
   {"title":"Boosts immunity","body":"Strengthens the immune system and helps the body fight against infection."}]',
 '["Whole dried aavaram poo flowers (Senna auriculata), 100%"]',
 '{"temp_c":95,"minutes":6,"steps":[
    "One heaped teaspoon of dried flowers per 200 ml.",
    "Pour boiling water and cover.",
    "Six minutes. The cup should be clear gold, never cloudy.",
    "Strain. Good plain, better with a little honey."],
   "iced":"Brew, chill, and serve with a slice of orange."}',
 '["Caffeine free","Natural goodness","Hand-sorted","Rooted in Siddha tradition"]',
 '{"title":"Aavaram Poo Tea — Senna Auriculata Flowers | ZION Herbs",
   "description":"Whole dried aavaram poo flowers from Tamil Nadu. Traditionally used to support blood sugar balance, digestion and skin. Caffeine free.",
   "keywords":["aavaram poo tea","aavaram poo benefits","senna auriculata","tanners cassia","siddha herbal tea","blood sugar herbal tea"]}',
 true, 6)

) as v(name, slug, script_word, botanical_name, tagline, short_desc, description, story,
       accent_color, accent_soft, hero_image, benefits, ingredients, brewing, badges, seo,
       is_featured, sort_order)
cross join (select id from categories where slug = 'single-origin') c
on conflict (slug) do nothing;

-- ============================================== 7 & 8. SETS =========
insert into products (
  category_id, name, slug, script_word, tagline, short_desc, description, story,
  accent_color, accent_soft, hero_image, benefits, ingredients, brewing, badges, seo,
  is_featured, sort_order
)
select c.id, v.name, v.slug, v.script_word, v.tagline, v.short_desc,
       v.description, v.story, v.accent_color, v.accent_soft, v.hero_image,
       v.benefits::jsonb, v.ingredients::jsonb, v.brewing::jsonb,
       v.badges::jsonb, v.seo::jsonb, v.is_featured, v.sort_order
  from (values

('The Six Discovery Box', 'the-six-discovery-box', 'Discovery Box',
 'Six nature, one wellness',
 'All six infusions in one box — 50 g of each. The honest way to find your one.',
 'Nobody should have to guess which herbal tea suits them from a product page. The discovery box is fifty grams of each of the six, which is roughly ten cups apiece: enough to drink each one properly, at different times of day, and work out which two you actually want to keep buying.',
 'This is the box we send to anyone who asks us where to start. It is also, by some distance, our most-gifted product.',
 '#C8A44D', '#EBD08A', '/brand/range-poster-dark.jpg',
 '[{"title":"Six full-size tastings","body":"50 g each of butterfly pea, hibiscus, chamomile, lavender, nannari and aavaram poo."},
   {"title":"Around sixty cups","body":"Roughly ten cups from each tin — enough to judge properly."},
   {"title":"Brewing card included","body":"Temperature and time for each of the six, printed and packed in."},
   {"title":"Gift ready","body":"Ships in the presentation box with no pricing anywhere inside."}]',
 '["Butterfly pea 50 g","Hibiscus 50 g","Chamomile 50 g","Lavender 50 g","Nannari 50 g","Aavaram poo 50 g"]',
 '{"steps":["Each tea brews differently. The card in the box gives the temperature and time for all six."]}',
 '["Caffeine free","Best value","Gift ready","Free delivery"]',
 '{"title":"The Six Discovery Box — All Six ZION Herbal Teas | ZION Herbs",
   "description":"50 g each of all six ZION infusions, around 60 cups. Caffeine free, gift-ready, free delivery. The best way to find the one that suits you.",
   "keywords":["herbal tea gift set","herbal tea sampler india","tea discovery box","caffeine free tea gift"]}',
 true, 7),

('The Calm Trio', 'the-calm-trio', 'Evening Set',
 'For the last hour of the day',
 'Chamomile, lavender and butterfly pea — the three that wind the day down.',
 'Three teas chosen for one job. Chamomile for the hour before bed, lavender when the day has been loud, butterfly pea for the evening you still want to feel clear-headed. All caffeine free, so none of them will keep you up.',
 'Put together after a year of order data made it obvious: people who buy chamomile almost always come back for lavender.',
 '#6B4E9B', '#8E6FC4', '/brand/range-poster-light.jpg',
 '[{"title":"Three evening infusions","body":"100 g each of chamomile, lavender and butterfly pea."},
   {"title":"Caffeine free, all three","body":"Nothing in this box will keep you awake."},
   {"title":"Gift ready","body":"Ships in the presentation sleeve."}]',
 '["Chamomile 100 g","Lavender 100 g","Butterfly pea 100 g"]',
 '{"steps":["Chamomile: 90°C, 5 minutes. Lavender: 85°C, 3 minutes. Butterfly pea: 90°C, 4 minutes."]}',
 '["Caffeine free","Evening ritual","Gift ready"]',
 '{"title":"The Calm Trio — Chamomile, Lavender and Butterfly Pea | ZION Herbs",
   "description":"Three caffeine-free evening infusions: chamomile, lavender and butterfly pea. 100 g each, gift-ready.",
   "keywords":["calming tea set","tea for sleep","chamomile lavender set","caffeine free evening tea"]}',
 false, 8)

) as v(name, slug, script_word, tagline, short_desc, description, story,
       accent_color, accent_soft, hero_image, benefits, ingredients, brewing, badges, seo,
       is_featured, sort_order)
cross join (select id from categories where slug = 'gift-sets') c
on conflict (slug) do nothing;

-- =====================================================================
-- VARIANTS
-- =====================================================================
insert into product_variants (product_id, sku, label, weight_grams, price, compare_at_price, stock, is_default, sort_order)
select p.id, v.sku, v.label, v.grams, v.price, v.mrp, v.stock, v.is_def, v.ord
from (values
 ('butterfly-pea','ZH-BP-100','100 g',100,349.00,399.00,120,true,1),
 ('butterfly-pea','ZH-BP-250','250 g',250,749.00,899.00,60,false,2),
 ('hibiscus','ZH-HB-100','100 g',100,299.00,349.00,140,true,1),
 ('hibiscus','ZH-HB-250','250 g',250,649.00,799.00,70,false,2),
 ('chamomile','ZH-CM-100','100 g',100,399.00,449.00,110,true,1),
 ('chamomile','ZH-CM-250','250 g',250,899.00,1049.00,45,false,2),
 ('lavender','ZH-LV-100','100 g',100,449.00,529.00,80,true,1),
 ('lavender','ZH-LV-250','250 g',250,999.00,1199.00,35,false,2),
 ('nannari','ZH-NN-100','100 g',100,279.00,329.00,150,true,1),
 ('nannari','ZH-NN-250','250 g',250,599.00,729.00,75,false,2),
 ('aavaram-poo','ZH-AP-100','100 g',100,299.00,349.00,130,true,1),
 ('aavaram-poo','ZH-AP-250','250 g',250,649.00,799.00,65,false,2),
 ('the-six-discovery-box','ZH-SET-SIX','6 × 50 g',300,1499.00,1899.00,40,true,1),
 ('the-calm-trio','ZH-SET-CALM','3 × 100 g',300,1099.00,1297.00,50,true,1)
) as v(slug, sku, label, grams, price, mrp, stock, is_def, ord)
join products p on p.slug = v.slug
on conflict (sku) do nothing;

-- =====================================================================
-- GALLERY -- the alternate hibiscus artwork and the lavender packshot
-- =====================================================================
insert into product_images (product_id, url, alt, sort_order)
select p.id, v.url, v.alt, v.ord
from (values
 ('hibiscus','/products/hibiscus-lifestyle.jpg','A cup of ZION hibiscus tea being enjoyed among fresh hibiscus flowers',1),
 ('lavender','/products/lavender-tin.jpg','The ZION lavender herbal infusion tin, 500 g, with fresh lavender',1)
) as v(slug, url, alt, ord)
join products p on p.slug = v.slug
where not exists (select 1 from product_images i where i.product_id = p.id and i.url = v.url);

-- =====================================================================
-- FAQ -- rendered on the page AND emitted as FAQPage JSON-LD.
-- Written as direct answers, because that is what gets quoted back by
-- assistants and featured snippets.
-- =====================================================================
insert into faqs (question, answer, category, scope, sort_order)
select * from (values

('Are ZION herbal teas caffeine free?',
 'Yes. All six ZION infusions — butterfly pea, hibiscus, chamomile, lavender, nannari and aavaram poo — are completely caffeine free. None of them contain any Camellia sinensis (the plant that black, green and oolong tea come from), so there is no caffeine at any stage. You can drink them late in the evening.',
 'product', 'global', 1),

('What is aavaram poo and what is it used for?',
 'Aavaram poo is the flower of Senna auriculata, a shrub that grows across the drier districts of Tamil Nadu. In Siddha medicine it has been used for generations to support blood sugar balance, digestion and skin health. Brewed as a tea it is mild, clear gold, and slightly sweet, with no bitterness.',
 'ingredients', 'global', 2),

('What is nannari?',
 'Nannari is the root of Hemidesmus indicus, also called Indian sarsaparilla. It is a traditional Tamil body coolant, most familiar as nannari sherbet drunk in summer. As a tea it is woody and faintly vanilla-sweet, and it is taken to help cool the body, support digestion and aid natural detoxification.',
 'ingredients', 'global', 3),

('Why does butterfly pea tea turn purple?',
 'Butterfly pea flowers contain anthocyanins, pigments that change colour with acidity. The tea brews deep blue, and adding anything acidic — lime or lemon juice — shifts it to violet or pink within seconds. It is a real chemical change, not a dye or additive.',
 'product', 'global', 4),

('How much tea do I get in a 100 g pack?',
 'A 100 g pack gives roughly 40 to 50 cups, depending on the tea. Flowers such as chamomile and butterfly pea are light, so 100 g goes a long way; nannari root is denser and gives fewer, stronger cups. A heaped teaspoon per 200 ml cup is the standard measure.',
 'product', 'global', 5),

('Do you ship across India?',
 'Yes. We ship to every serviceable pincode in India from our unit in Tamil Nadu. Delivery is free on orders over ₹999, and ₹69 below that. Orders in Chennai, Coimbatore, Madurai, Tiruchirappalli and Salem usually arrive in two to three working days; the rest of India takes four to six.',
 'shipping', 'global', 6),

('How does the ZION referral programme work?',
 'Every account gets a personal referral link. Share it, and when a friend signs up through it and completes their first order, they get a discount on that order and you get ZION Coins credited to your wallet. Coins convert to rupees off a future order at the published rate. You can see your link, your clicks and your balance in your account.',
 'referral', 'global', 7),

('What are ZION Coins worth?',
 'ZION Coins convert to money off your order at the rate shown in your wallet — currently 10 coins to ₹1. So 2,000 coins is ₹200 off. Coins can cover up to a quarter of an order subtotal, and you need a minimum of 500 coins before you can spend any.',
 'referral', 'global', 8),

('Are these teas safe during pregnancy or with medication?',
 'Herbal infusions are food, not medicine, and we make no medical claims. That said, some botanicals — hibiscus and senna-family herbs in particular — are not usually recommended during pregnancy, and some can interact with medication. If you are pregnant, breastfeeding, or on regular medication, ask your doctor before adding any herbal tea to your routine.',
 'safety', 'global', 9),

('Is there anything in these teas besides the herb?',
 'No. Every single-origin pack is 100% the named botanical — no added flavouring, no colour, no preservative, no filler, no blending agent. The ingredient list on a pack of ZION hibiscus reads: hibiscus.',
 'ingredients', 'global', 10),

('How should I store the tea?',
 'Keep it in the tin, sealed, somewhere cool and dark, and away from the stove. Whole flowers and roots keep their aroma for about eighteen months stored this way. Do not refrigerate — condensation is what actually spoils dried botanicals.',
 'product', 'global', 11),

('Can I order on WhatsApp instead?',
 'Yes. Message +91 63840 13131 with what you want and a delivery pincode, and we will confirm the order and payment there. The website checkout is faster, but plenty of our customers prefer WhatsApp and that is entirely fine.',
 'ordering', 'global', 12)
) as v(question, answer, category, scope, sort_order)
where not exists (select 1 from faqs f where f.question = v.question);
