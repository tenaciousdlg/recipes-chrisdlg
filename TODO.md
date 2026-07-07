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

DONE 2026-07-08: added Steamed Jasmine Rice + Mashed Potatoes (base) and
Roasted Broccoli/Green Beans, Cornbread, Greek Cucumber-Tomato Salad, Naan,
Garlic Bread, Coleslaw (side). Now 31 main / 5 base / 6 side / 4 snack out of
46. Mexican/Tex-Mex, American, Mediterranean, Indian, Italian, and Cajun
lanes all have at least one dedicated side now; Korean and Vietnamese still
rely on the jasmine rice / roasted veg universals rather than a lane-specific
side, which is fine for now.

Also added the first breakfast recipe (Oatmeal with Peanut Butter and
Berries) and a `breakfast` tag, chipping into the menu-tracking gap above
(was 0/5).

## Meal suggestion widget on the homepage

DONE 2026-07-08: "Tonight's suggestion" box at the top of the homepage,
picks a random main (breakfast excluded) plus a base and/or side, client-side
so it re-randomizes per visit. Prefers same-cuisine pairings over the
universal jasmine-rice/roasted-veg fallback, verified via a 200-trial script
against real data. "Suggest something else" button re-rolls without a
reload.

Known shape it doesn't cover: it always tries for one base + one side rather
than ever doubling up on two bases from the same cuisine (e.g. it won't
suggest Spanish Rice + Refried Beans together, since Refried Beans is a
base and Roasted Broccoli already fills the side slot). Produces a more
balanced plate in practice; revisit only if that feels wrong in use.
