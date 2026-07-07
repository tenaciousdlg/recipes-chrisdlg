# TODO

## Menu tracking page

Build a `/menu/` page backed by a small `src/data/menu.yaml` that mirrors the
master cookbook list (Breakfast, Lunch/Dinner Anytime, Hot season, Cold season,
Snacks/Dessert). Each item auto-links to its matching recipe where one exists;
unmatched items show as open gaps. Turns the list into a living checklist
instead of a manual diff against the site.

Coverage as of 2026-07-07: Hot season 3/3, Cold season 7/8 (missing Goulash),
Snacks/Dessert 3/3, Lunch/Dinner ~9/19, Breakfast 0/5 (biggest gap: oatmeal,
bagel, eggs, pancakes, smoothie all unbuilt). Other Lunch/Dinner gaps: roasted
chicken thighs w/ potatoes+veggies, baked ziti, marinara+meatballs, King Ranch
chicken, fideo con pollo, calabaza con pollo, burritos, red beans and rice.

Holding off until more of the gaps above are closed.

## Rebalance mains vs. sides/bases

As of 2026-07-08: 30 main / 3 base / 4 snack out of 37 recipes. Worse than the
ratio suggests -- 10 different recipes say "serve over rice" and there's no
plain rice recipe at all (only spanish-rice, a specific Mexican prep). Every
cuisine except Mexican has zero dedicated sides: American has 8 mains and 0
sides, Indian/Italian/Korean/Mediterranean/Cajun/Vietnamese all have 0.

Priority: plain rice first (biggest lever, pairs with the most existing
mains), then 3-4 more universal/cuisine-anchored sides (roasted vegetable,
American-lane coleslaw, maybe naan or a lentil side for the Indian dish)
rather than giving every cuisine its own side immediately.

## Meal suggestion widget on the homepage

Randomized but realistic meal suggestions at the top of the recipe list
(e.g. "Carne con Papas + Spanish Rice + (Not) Refried Beans"). No schema
changes needed -- `cuisine` and `category` already support pairing a main to
a base/snack in the same cuisine (or a small "goes with anything" allowlist
for things like plain rice). Blocked on inventory, not architecture: with
only 3 bases today, a random suggester would just repeat the same 2-3
pairings. Do the sides rebalance above first.
