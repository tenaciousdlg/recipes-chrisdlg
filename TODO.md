# TODO

## Menu tracking page

DONE 2026-07-07: `/menu/` page backed by `src/data/menu.yaml`, mirroring the
master cookbook list (Breakfast, Lunch/Dinner Anytime, Hot season, Cold
season, Snacks/Dessert). Cross-checks each item's `recipe` slug against the
live collection at build time (not trusted blindly), so a renamed/removed
recipe reverts to an open gap instead of a dead link. Nav link added next to
Shopping list.

Coverage at ship: 25/38 overall. Hot season 3/3, Cold season 7/8 (missing
Goulash), Snacks/Dessert 3/3, Lunch/Dinner 11/19, Breakfast 1/5 (oatmeal
built; bagel, eggs, pancakes, smoothie still open). Other Lunch/Dinner gaps:
roasted chicken thighs w/ potatoes+veggies, baked ziti, marinara+meatballs,
King Ranch chicken, fideo con pollo, calabaza con pollo, burritos, red beans
and rice.

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

Fixed 2026-07-07: was pairing pasta/noodle/gnocchi mains (already their own
starch) with a rice or potato base on top, e.g. "Turkey Gnocchi Ragù with
Steamed Jasmine Rice and Garlic Bread." Added a `self_contained` schema field
(set on Christine's Lasagna, Pork and Peanut Dragon Noodles, Turkey Gnocchi
Ragù) that skips the base pool and the base/side fallback-fill entirely,
leaving room for just a side. Verified via 500 simulated trials against the
real built data: every self-contained-main trial paired with a side only,
never a base.

Fixed 2026-07-07 (second pass): two more bad pairings reported. (1) "Beef
and Cabbage Stir Fry with Orange Sauce (for chicken)" — Orange Sauce was
mis-filed as `category: base` (its own notes even flagged this: "no
dedicated sauce/component category yet"), so the widget treated a
protein-glaze as if it were a side dish. Added a `sauce` category, excluded
it from the pairing pool entirely (a sauce isn't served alongside a dish,
it's tossed with a specific protein). (2) "Chicken with Lime, Garlic, and
Cilantro with Mashed Potatoes and Cornbread" — the chicken was tagged
`cuisine: American` as a default/catch-all, which pulled in Southern
comfort-food sides that clash with its bright citrus-herb profile. Cleared
its cuisine so it falls into the universal pool (jasmine rice, roasted
veg) instead. Re-verified via 1000 simulated trials: zero sauce-as-pairing
occurrences, and the lime chicken now only ever pairs with jasmine rice
and/or roasted broccoli.
