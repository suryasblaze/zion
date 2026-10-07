-- =====================================================================
-- ZION Herbs -- seed_event.sql
-- Settings for the event sampling form. Re-runnable.
-- =====================================================================

insert into admin_settings
  (key, value, value_type, group_key, label, description, ui_control, options, min_value, max_value, is_public, sort_order)
values

('event.form_enabled', 'true', 'boolean', 'event',
 'Sampling form is open',
 'Turn this off when the event ends. The page then says sampling has closed instead of taking details it cannot honour.',
 'toggle', '[]', null, null, true, 1),

('event.slug', '"default"', 'string', 'event',
 'Event code',
 'Short identifier used to group sign-ups, e.g. chennai-expo-2026. The one-sample-per-phone limit applies within a single event, so change this for each new one.',
 'text', '[]', null, null, false, 2),

('event.name', '"ZION tasting"', 'string', 'event',
 'Event name',
 'Shown on the form and stored against every sign-up.',
 'text', '[]', null, null, true, 3),

('event.headline', '"Pick a tea. It is on us."', 'string', 'event',
 'Headline',
 'The first line someone reads when they open the link.',
 'text', '[]', null, null, true, 4),

('event.intro',
 '"Tell us where to find you and which of the six you would like to try. Show the code on the next screen at the counter and it is yours."',
 'string', 'event',
 'Intro text',
 'One or two sentences under the headline.',
 'textarea', '[]', null, null, true, 5),

('event.thank_you',
 '"Show this code at the counter to collect yours."',
 'string', 'event',
 'Thank-you message',
 'Shown above the claim code after someone submits.',
 'textarea', '[]', null, null, true, 6),

('event.closed_message',
 '"Sampling has finished for this event. Thank you to everyone who came by."',
 'string', 'event',
 'Message when closed',
 'Shown instead of the form once sampling is switched off.',
 'textarea', '[]', null, null, true, 7),

('event.collect_email', 'false', 'boolean', 'event',
 'Ask for an email too',
 'Off by default. At a stall, every extra field costs you sign-ups.',
 'toggle', '[]', null, null, true, 8),

('event.one_per_phone', 'true', 'boolean', 'event',
 'One sample per phone number',
 'Stops the same person claiming several. A repeat submission is shown their original code rather than an error.',
 'toggle', '[]', null, null, false, 9)

on conflict (key) do nothing;
