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

Fixed 2026-07-07 (third pass): exhaustively enumerated every main's possible
pairings (not just random sampling) and found Mexican Quinoa Skillet had the
same bug as the gnocchi/lasagna/noodles case — quinoa is its primary
ingredient (plus black beans already in the pot), so it could still get
Spanish Rice or Refried Beans stacked on top. Marked it `self_contained`
too. Scanned every other main's primary ingredient for grain/starch keywords
(rice, pasta, noodle, couscous, etc.) and found no other gaps. 2000-trial
regression: zero violations across both the sauce-pairing and
self-contained-base rules.

Open question, not fixed: Broccoli Cheddar Soup and Cabbage Soup can still
draw Mashed Potatoes as a base (they're `cuisine: American`, same bucket as
the pork-chop/pot-roast/meatloaf lane). A soup is already a complete bowl,
so "cabbage soup with a side of mashed potatoes" reads a little odd, though
it's not absurd the way sauce-as-a-side or double-starch was. `self_contained`
as currently written means "has its own starch baked in," which isn't
literally true for either soup, so reusing that flag would overstate the
reason. Left alone pending a decision on whether soups should skip the base
pool on general principle.

## Macro-accuracy and shopping-list hardening audit

DONE 2026-07-07: cross-checked every recipe's hand-entered `macros_per_serving`
against a from-scratch computation off `ingredients.yaml`, using each
recipe's own steps to judge whether a manual estimate was a rough placeholder
or already correctly accounted for (fry oil not absorbed, fat skimmed off a
braise, an externally-sourced published nutrition label).

Found and fixed a real ingredient-database bug: `ramen noodles` was priced on
a cooked-weight basis (135 cal/100g) but every recipe measures it by
purchased/dry package weight, undercounting Pork and Peanut Dragon Noodles by
roughly half. Corrected to a dry pre-fried-noodle-brick basis (440 cal/100g).

Recomputed and corrected 10 recipes whose manual macros were unbacked
placeholders (several notes literally said "approximate until logged"):
Orange Sauce, Gochujang Chicken Stir-Fry, Harissa Chicken Bowls, Al
Pastor-Style Chicken Thighs, Tex-Mex Beef & Bean Bowl, Carne con Papas,
Spanish Rice, Pot Roast, Instant Pot Pork Roast, Jambalaya. Marked
`source: computed` on each.

Deliberately left four alone:
- Pan-Fried Pork Chops and Chicken and Sausage Gumbo both have a real
  discard step (shallow-fry oil mostly stays in the pan; gumbo's steps say
  "skimming fat"), so a naive full-ingredient computation overstates them.
  The manual figures are more trustworthy than my computation here.
- "All You Can Eat" Cabbage Soup and Sheet Pan BBQ Meatloaf Dinner both use
  Budget Bytes' own published nutrition facts verbatim, an external source
  that outranks an internal recompute. Meatloaf's gap traces to the shared
  `ground beef` DB entry being tuned to 93/7 (per tex-mex-beef-bean-bowl)
  while this recipe calls for 80/20 — a database-granularity limitation
  worth a `ground beef (80/20)` variant if more fatty-ground-beef recipes
  get added, not urgent for one externally-sourced recipe.

Also hardened `aggregateIngredients` in `shoppingList.ts`: the cross-unit
merge required every unit to have an explicit `grams_per_unit` entry in
ingredients.yaml, but `g`/`kg` are never listed there (they're implicit).
Only one recipe currently measures anything in raw grams (Turkey Gnocchi
Ragù's gnocchi), so this hadn't bitten yet, but the next gram-measured
ingredient that also shows up in another recipe by a different unit would
have silently failed to merge — the exact ginger/gochujang bug from
earlier, resurfacing. Fixed by resolving g=1/kg=1000 implicitly instead of
requiring them in the yaml. Verified against a synthetic 100g + 2 tbsp case
(merges correctly now) plus a regression test on the original tbsp/tsp
ginger case (still merges) and an unconvertible-unit case (still correctly
stays split).

Confirmed via a full sweep: every ingredient+unit pair actually used across
all 46 recipes has gram-conversion coverage, and scaling to 0.5x/1.5x/2x/3x
produces clean, kitchen-measurable fractions everywhere except two spots:
`active dry yeast` and the egg wash in Soft Pretzels were unit `count`
(whole packet / whole egg), so scaling produced things like "1.5 packets of
yeast" — not buyable or usable. Marked both `scale: false` (yeast dough is
already forgiving of exact ratios, and egg wash coats any batch size), matching
the site's existing convention for aromatics/salt.
