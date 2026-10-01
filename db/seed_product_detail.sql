-- =====================================================================
-- ZION Herbs -- seed_product_detail.sql
-- Taste, origin, nutrition and reasons-to-buy for each product.
-- Re-runnable: updates by slug, writes nothing new.
-- =====================================================================

update products p set
  taste_aroma = v.taste,
  origin      = v.origin,
  nutrition   = v.nutrition::jsonb,
  why_love    = v.why_love::jsonb
from (values

-- ============================================== BUTTERFLY PEA ========
('butterfly-pea',
 'Soft and faintly earthy, closer to a good green tea than to anything floral. Barely any aroma until the water hits it, then a clean grassy sweetness. Lemon sharpens it; honey rounds it out.',
 'Grown in Tamil Nadu and gathered as whole blooms, not broken petals. Shade-dried so the pigment survives, then hand-sorted. Whole flowers hold both colour and aroma far longer in storage than milled petals.',
 '{"serving":"200 ml","calories":"0 kcal","caffeine":"None","sugar":"0 g","notes":["Anthocyanins, the pigments that make it blue","No additives, colour or preservative"]}',
 '["It turns violet when you add lime, in front of you","Caffeine free, so an evening cup costs you nothing","Whole flowers, so it still smells of something","The most striking thing you can hand a guest"]'),

-- ============================================== HIBISCUS =============
('hibiscus',
 'Sharp and bright, like cranberry with the sugar taken out. Smells faintly of red berries and tamarind. The most assertive tea in the range, and the one that takes honey best.',
 'Grown across Tamil Nadu and dried within hours of picking, which is why the colour comes out garnet rather than brown. Only the calyx is used, never the leaf.',
 '{"serving":"200 ml","calories":"0 kcal","caffeine":"None","sugar":"0 g","notes":["Naturally high in Vitamin C","Anthocyanins and organic acids from the calyx"]}',
 '["Brews a colour that does not look real","The best of the six over ice","Tart enough to drink without sugar","Dried same-day, so it tastes clean rather than dusty"]'),

-- ============================================== CHAMOMILE ============
('chamomile',
 'Honeyed and apple-sweet, with a warm hay aroma that arrives the moment you pour. Rounded and gentle. No bitterness at all if you keep to five minutes.',
 'Whole flower heads, never milled. Chamomile''s aromatic oils sit in the yellow disc at the centre of the flower and escape within days of grinding, which is why most chamomile tastes of so little.',
 '{"serving":"200 ml","calories":"0 kcal","caffeine":"None","sugar":"0 g","notes":["Apigenin, the compound chamomile is known for","Whole flower heads, not dust"]}',
 '["You can see the individual flowers in the tin","The easiest of the six to get right","The cup for the last hour of the evening","Gentle enough for every day"]'),

-- ============================================== LAVENDER =============
('lavender',
 'Floral and clean, slightly sweet, with a cool minty finish. Smells like a summer field rather than soap, which is entirely a matter of how briefly you brew it.',
 'The one botanical we do not source from Tamil Nadu. Culinary-grade Lavandula angustifolia needs altitude and a dry summer, so ours comes from the hills. Sorted and packed in our own unit.',
 '{"serving":"200 ml","calories":"0 kcal","caffeine":"None","sugar":"0 g","notes":["Linalool and linalyl acetate, the calming aromatics","Culinary grade, not cosmetic"]}',
 '["Culinary grade, so it never tastes like perfume","Three minutes and it is perfect; four and it is not","Pairs with honey and lemon better than anything here","The one to reach for after a loud day"]'),

-- ============================================== NANNARI ==============
('nannari',
 'Woody and faintly vanilla-sweet, with a long cooling finish. The aroma is unmistakable if you grew up here: sarsaparilla, root beer, summer afternoons.',
 'Hemidesmus indicus root, gathered in Tamil Nadu and cut coarse rather than powdered. Finely milled nannari loses its aroma and gives a muddy cup, so we accept the extra bulk.',
 '{"serving":"200 ml","calories":"0 kcal","caffeine":"None","sugar":"0 g","notes":["Coumarins, which give the sarsaparilla aroma","Coarse-cut root, not powder"]}',
 '["The nannari sherbet you remember, in a tin","A genuine body coolant, not a marketing line","Rooted in Siddha practice, not invented for a label","Brews strong enough to sweeten with jaggery and ice"]'),

-- ============================================== AAVARAM POO ==========
('aavaram-poo',
 'Mild and lightly sweet, a little grassy, with no bitterness whatsoever. Faint honey aroma. The easiest tea here to drink several cups of in a day.',
 'Senna auriculata grows as scrub across the drier districts of Tamil Nadu and flowers bright yellow most of the year. Dried whole and hand-sorted, never shredded.',
 '{"serving":"200 ml","calories":"0 kcal","caffeine":"None","sugar":"0 g","notes":["Flavonoids and polyphenols from the whole flower","Hand-sorted, single botanical"]}',
 '["Cherished in Siddha medicine for generations","Clear gold in the cup, never cloudy","Mild enough for several cups a day","Rarely sold outside Tamil Nadu at this standard"]'),

-- ============================================== DISCOVERY BOX ========
('the-six-discovery-box',
 'Six different cups, from the sharp tartness of hibiscus to the woody sweetness of nannari. The point is the contrast: you will know which two are yours by the end of the week.',
 'All six botanicals, each from its own source, packed together in our unit in Tamil Nadu. The brewing card is printed with the tested temperature and time for each.',
 '{"serving":"200 ml","calories":"0 kcal","caffeine":"None","notes":["50 g of each of the six","Around ten cups per tea, sixty in total"]}',
 '["The honest way to find your one, rather than guessing","Around sixty cups for less than buying two tins","Brewing card included, so nothing is wasted","Ships gift-ready, with no pricing inside"]'),

-- ============================================== CALM TRIO ============
('the-calm-trio',
 'Three quiet cups. Chamomile honeyed and soft, lavender floral and cool, butterfly pea clean and faintly grassy. Nothing here is sharp.',
 'Chamomile and butterfly pea from Tamil Nadu, lavender from the hills. Packed together in the presentation sleeve.',
 '{"serving":"200 ml","calories":"0 kcal","caffeine":"None","notes":["100 g each of three teas","All three caffeine free"]}',
 '["Chosen for one job: the last hour of the day","Nothing in the box will keep you awake","100 g of each, so it lasts","The set people buy after their first chamomile"]')

) as v(slug, taste, origin, nutrition, why_love)
where p.slug = v.slug;
