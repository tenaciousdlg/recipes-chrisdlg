# TODO

## Roadmap (from the 2026-07-08 grading pass)

Graded as a personal cookbook/intelligent-recipe-app: data rigor A-, cooking UX B+, shopping
UX A-, intelligence/personalization C+, content breadth B-, engineering discipline A. Overall
B+. The items below are what would move each grade up, grouped by dimension and roughly
ordered by priority within each. Nothing here is committed work, just the backlog this
project's own assessment pointed at.

### Content breadth (B- -> A): cuisine and side coverage, not menu-list checkboxes

The `/menu/` list was a brain-dump of "what do we eat," not a spec — items like "eggs with
breakfast meat" or "bagel with cream cheese" don't need a structured recipe card in the app's
current form, so raw menu-gap count isn't the real signal. Pulling the actual distribution
across all 49 recipes surfaced the real issues instead:

- **Two cuisine lanes dominate.** American (13) + Mexican/Tex-Mex (14) = 27 of 49 recipes,
  55% of the whole site. Everything else is thin: Asian 4, Italian 4, Mediterranean 3,
  Indian 2, Korean 2, Cajun 2, Vietnamese 1.
- **Mains outnumber pairing partners badly.** 33 mains against only 6 sides + 4 bases.
  **Asian, Korean, Cajun, Tex-Mex, and Vietnamese mains have zero dedicated side** — they all
  fall back to the same universal jasmine rice / roasted broccoli, so those cuisines never
  actually get a lane-specific pairing the way Mexican or American mains do.
- **Tex-Mex mains never pair with Mexican sides, and probably should.** The meal-suggestion
  widget matches cuisine by exact string, so a `cuisine: Tex-Mex` main doesn't count as a
  match for `cuisine: Mexican` sides (Spanish Rice, Refried Beans) even though they're a
  completely natural real-world pairing. Cheap fix, worth doing before adding any new recipes:
  either relabel the 3 Tex-Mex recipes to `Mexican` if the distinction isn't load-bearing
  elsewhere, or teach the pairing logic a small cuisine-affinity map.
- **Chicken thigh is the primary ingredient in 10 of 49 recipes (20%).** The dishes themselves
  are genuinely differentiated (Mexican al pastor, Cajun gumbo, Korean stir-fry, Mediterranean
  bowl-braise), so this reads more as grocery-list repetition than eating-experience
  repetition — lower priority than the cuisine/side gaps above, but worth knowing about when
  picking what to add next.

### Intelligence / personalization (C+ -> B+): the actual weak spot

- **No sauce-to-protein combinator.** Orange Sauce and Homemade Marinara are already built as
  swappable platform sauces (Orange Sauce's own notes say "swap chicken for salmon, shrimp, or
  tofu with no change to the sauce"), but there's no system support for that pattern — no way
  to say "pick a sauce, pick a protein, get a meal" the way the meal-suggestion widget does for
  main+side. This is a genuinely different feature than "add more recipes": a component-based
  meal builder, extending the same pairing-engine idea to sauce+protein as the combinable units.
- **Meal-suggestion widget is single-shot, not a planner.** It re-rolls one random
  suggestion per visit; it doesn't plan a week, avoid repeats across days, or balance
  nutrition across a stretch of meals.
- **No use of `made_log` for recommendations.** Every recipe already tracks when it's been
  cooked, but nothing reads that data back — no "you haven't made this in 2 months" surfacing,
  no frequency-aware suggestion weighting.
- **No pantry-driven search.** Search matches recipe text; there's no "what can I make with
  chicken, cabbage, and rice" reverse lookup against ingredients.
- **Search is plain substring matching**, not fuzzy or ingredient-structure-aware (e.g.
  searching "spicy" as a concept vs. relying on the `spicy` tag already existing).

### Cooking UX (B+ -> A)

- No read-aloud or hands-free step navigation during cooking mode (screen-wake + bigger text
  only, which was a deliberate, scoped choice, not an oversight).
- No built-in step timers (e.g. "simmer 30 min" as a tappable countdown instead of just text).

### Shopping UX (A- -> A)

- No pantry awareness: the shopping list has no way to say "skip onions, I already have some."
- Aisle grouping is by category only, not personalized to a specific store's layout.

### Data rigor (A- -> A): one known, low-priority gap

- Shared `ground beef` ingredient DB entry is tuned to 93/7 (per Tex-Mex Beef & Bean Bowl);
  Sheet Pan BBQ Meatloaf actually uses 80/20 and its macros come from Budget Bytes' own label
  instead of the DB for that reason. Worth a `ground beef (80/20)` variant only if more
  fatty-ground-beef recipes get added — not urgent for one externally-sourced recipe.

### Engineering discipline (A): no open items

Schema validation, tag/category controlled vocabulary, and the real-execution testing habit
(extract the actual bundled script, run it against real data) are all already in good shape.
Keep applying the same rigor to whatever gets built from the list above.

---

## Completed

<details>
<summary>Menu tracking page — DONE 2026-07-07</summary>

`/menu/` page backed by `src/data/menu.yaml`, mirroring the master cookbook list (Breakfast,
Lunch/Dinner Anytime, Hot season, Cold season, Snacks/Dessert). Cross-checks each item's
`recipe` slug against the live collection at build time (not trusted blindly), so a
renamed/removed recipe reverts to an open gap instead of a dead link. Nav link added next to
Shopping list.

</details>

<details>
<summary>Rebalance mains vs. sides/bases — DONE 2026-07-08</summary>

Added Steamed Jasmine Rice + Mashed Potatoes (base) and Roasted Broccoli/Green Beans,
Cornbread, Greek Cucumber-Tomato Salad, Naan, Garlic Bread, Coleslaw (side). Mexican/Tex-Mex,
American, Mediterranean, Indian, Italian, and Cajun lanes all have at least one dedicated side
now; Korean and Vietnamese still rely on the jasmine rice / roasted veg universals, which is
fine. Also added the first breakfast recipe (Oatmeal with Peanut Butter and Berries) and a
`breakfast` tag.

</details>

<details>
<summary>Meal suggestion widget on the homepage — DONE 2026-07-08, iterated 2026-07-07</summary>

"Tonight's suggestion" box at the top of the homepage, picks a random main (breakfast
excluded) plus a base and/or side, client-side so it re-randomizes per visit. Prefers
same-cuisine pairings over the universal jasmine-rice/roasted-veg fallback.

Four bug-fix passes after real usage surfaced bad pairings:
1. Pasta/noodle/gnocchi mains (already their own starch) were getting a rice or potato base
   stacked on top. Added a `self_contained` schema field to skip the base pool for those.
2. Orange Sauce was mis-filed as `category: base`, so it got suggested as a side for an
   unrelated main; added a dedicated `sauce` category, excluded from pairing entirely. Chicken
   with Lime, Garlic, and Cilantro was tagged `cuisine: American` as a catch-all, pulling in
   clashing Southern sides; cleared its cuisine so it lands in the universal pool instead.
3. Exhaustively enumerated every main's possible pairings (not just random sampling) and found
   Mexican Quinoa Skillet had the same self-contained-starch bug (quinoa + beans already in
   the pot).
4. Generalized `self_contained` to also cover "already a complete bowl" (not just "has its own
   starch") and applied it to all three soups, since a soup pairing with a starchy base like
   mashed potatoes read odd even though it wasn't as clearly broken as the other cases.

Verified at each step via simulated trials against real data (200 -> 500 -> 1000 -> 2000),
zero violations on the final pass. Known shape it doesn't cover: never doubles up on two bases
from the same cuisine (e.g. won't suggest Spanish Rice + Refried Beans together) — produces a
more balanced plate in practice, so left as-is.

</details>

<details>
<summary>Macro-accuracy and shopping-list hardening audit — DONE 2026-07-07</summary>

Cross-checked every recipe's hand-entered `macros_per_serving` against a from-scratch
computation off `ingredients.yaml`, using each recipe's own steps to judge whether a manual
estimate was a rough placeholder or already correctly accounted for (fry oil not absorbed, fat
skimmed off a braise, an externally-sourced published nutrition label).

Found and fixed a real ingredient-database bug: `ramen noodles` was priced on a cooked-weight
basis but every recipe measures it by purchased/dry package weight, undercounting Pork and
Peanut Dragon Noodles by roughly half.

Recomputed 10 recipes whose manual macros were unbacked placeholders (several notes literally
said "approximate until logged"): Orange Sauce, Gochujang Chicken Stir-Fry, Harissa Chicken
Bowls, Al Pastor-Style Chicken Thighs, Tex-Mex Beef & Bean Bowl, Carne con Papas, Spanish Rice,
Pot Roast, Instant Pot Pork Roast, Jambalaya. Deliberately left Pan-Fried Pork Chops, Chicken
and Sausage Gumbo (real discard/skim steps make the manual figures more trustworthy), and
Cabbage Soup + Sheet Pan BBQ Meatloaf (Budget Bytes' own published nutrition, an external
source that outranks internal recompute) alone.

Also hardened `aggregateIngredients` in `shoppingList.ts`: g/kg were never treated as
implicitly convertible, so the next gram-measured ingredient reused in another unit elsewhere
would have silently failed to merge — the exact ginger/gochujang bug resurfacing. Fixed by
resolving g=1/kg=1000 implicitly. Confirmed full ingredient+unit coverage across all recipes,
and that scaling to 0.5x-3x produces clean, kitchen-measurable fractions everywhere except
Soft Pretzels' yeast packet and egg wash, both fixed to `scale: false`.

</details>

<details>
<summary>Recipe additions — DONE 2026-07-08</summary>

Added Sopa de Fideo (family recipe), Calabaza con Pollo (web source, own published nutrition
used directly), and Budget Bytes' Homemade Marinara Sauce (filed as `category: sauce`, same
treatment as Orange Sauce). Split the old combined "marinara and meatballs" menu line into two
so partial progress tracks correctly. Converted Coleslaw from mayo to a vinegar-based dressing
per request, then removed celery seed from it per a follow-up request to avoid one-off pantry
ingredients. Added chicken breast, fideo, calabaza squash, zucchini, yellow squash, queso
fresco, basil, and (briefly, then removed) celery seed to `ingredients.yaml`; fixed a
`brown sugar` unit-coverage gap surfaced by the marinara recipe.

</details>

<details>
<summary>Tag hygiene audit — DONE 2026-07-08</summary>

Cross-checked every recipe's tags against its title, ingredients, and steps. Found and fixed 5
gaps: Christine's Lasagna had zero tags at all (added `pasta`, `baking`); Greek Yogurt Banana
Bread was missing `vegetarian`; (Not) Refried Beans was missing `vegan`; Harissa Chicken Bowls
and Vietnamese Caramel Salmon were both missing `braise` despite their own steps using the
word; the salmon was also missing `spicy` (whole Thai chili). Confirmed everything else was
already correct, including two cases that looked like they might be inconsistencies but
weren't (Turkey Chili vs. Three-Meat Chili's differing spicy tag reflects a real heat
difference; Spanish Rice correctly has no vegetarian tag since it uses chicken bouillon).

</details>

<details>
<summary>Ingredient/step consistency audit — DONE 2026-07-08</summary>

Two-directional check across all recipes: every listed ingredient referenced somewhere in its
own steps, and every ingredient-database name mentioned in steps actually listed as an
ingredient. Found and fixed 3 gaps: Turkey Gnocchi Ragù's black pepper was never mentioned in
any step; Christine's Lasagna's "season mildly" step didn't name salt; Beef and Cabbage Stir
Fry's step called its own listed "neutral oil" ingredient "cooking oil." Reverse-direction
check mostly surfaced false positives (optional garnish suggestions correctly left out of the
shopping list, prep-note alternatives already covered).

</details>

<details>
<summary>Search/sort/cooking-mode smoke test — DONE 2026-07-08</summary>

No browser automation available in this environment, so extracted the actual bundled
client-side scripts from a real build and ran them in Node's `vm` against a simulated DOM,
real card data from the built homepage, and a mocked Wake Lock API. 21 tests covering search,
all 8 sort modes, and cooking mode's enable/disable/restore/wake-lock paths, all passing on
the real shipped code. No site bugs found in this pass (two test-harness bugs found and fixed
along the way).

</details>

<details>
<summary>Shopping list Clear all button — DONE 2026-07-08</summary>

Checked recipes and quantities persist across visits via localStorage; added a "Clear all"
button next to Copy list so resetting doesn't require unchecking everything by hand. Verified
against the real bundled script: unchecks every recipe, resets quantities to defaults, and
clears the rendered output and persisted state.

</details>
