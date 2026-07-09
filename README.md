# recipes-chrisdlg

A structured personal cookbook at [recipes.chrisdlg.com](https://recipes.chrisdlg.com). Recipes
are markdown files with strictly-validated frontmatter, which is what makes the interesting
features possible: batch scaling anchored on a primary ingredient, an aggregated shopping list,
per-serving macros, and a meal-suggestion widget that understands cuisine lanes and dish
categories.

Built with [Astro](https://astro.build) (fully static output), deployed to Cloudflare Workers
via the `@astrojs/cloudflare` adapter. No database, no backend — the "app" behavior is small
client-side scripts working off JSON embedded at build time.

## The two core use cases

- **Cooking mode** — each recipe page has a toggle that bumps text size and (where the browser
  supports it) holds a screen wake lock, so a phone propped up in the kitchen stays readable
  and unlocked. State persists per-browser via `localStorage`.
- **Shopping mode** — `/shopping-list/` lets you check off the recipes you're making this week,
  adjust each one's batch size, and get a single aggregated list grouped by store section
  (produce, meat, dairy, ...) with a copy-to-clipboard export. The picker is searchable (same
  index as the homepage search), produce bought by the piece rounds up to whole items with the
  exact need shown ("1 red onion, need 1/4"), and per-item "have it" toggles keep pantry
  leftovers off the copied list. Selections and pantry state persist across visits.

Everything else (macros, tags, search/sort, the menu tracker, the suggestion widget) supports
those two.

## How scaling works

Every recipe marks exactly **one** ingredient `primary: true` (enforced by the schema). Scaling
is expressed in that ingredient's real units — "I have 2 lb of chicken thighs, not 1.25" —
rather than an abstract multiplier, and every other ingredient scales by the resulting factor.
Ingredients marked `scale: false` (salt, garnishes, a yeast packet) stay fixed. Quantities
display as kitchen-measurable fractions (1/3, 3/4) rather than decimals.

The shopping list uses the same mechanism: each selected recipe's batch size is set by its
primary-ingredient quantity, and the aggregator sums shared ingredients across recipes. Same
item in different units (ginger by tbsp in one recipe, tsp in another) merges via the
grams-per-unit table in `ingredients.yaml` when coverage exists, and stays as separate lines
when it doesn't.

## Data model

### Recipes — `src/content/recipes/*.md`

An Astro content collection validated by the zod schema in
[src/content.config.ts](src/content.config.ts). The fields that drive behavior:

| Field | Purpose |
| --- | --- |
| `category` | `main` / `base` / `side` / `snack` / `sauce` — drives meal-suggestion pairing. A `sauce` is a component tossed with a protein, never suggested as a side. |
| `cuisine` | Free-text lane (`Mexican`, `Korean`, ...). Omitted = "goes with anything" universal (plain rice, roasted veg). |
| `self_contained` | Main that shouldn't get a starchy base stacked on it — pasta/gnocchi/quinoa dishes and soups. |
| `ingredients[]` | Each line: `item`, `qty`, `unit` (controlled list), `section` (store aisle), optional `prep`, `group` (sub-component like "sauce"), `primary`, `scale`. |
| `macros_per_serving` | Calories/protein/carbs/fat with a `source` marker: `manual` (hand-entered) vs `computed` (recomputed from `ingredients.yaml`). |
| `source` | `original` / `budget-bytes` / `web` / `family` — `family` recipes are kept verbatim, never "optimized". |
| `made_log` | Dates cooked. Tracked but not yet read back by anything (see TODO). |
| `tags` | Controlled vocabulary only — dish format and objectively-checkable facts. Protein, cuisine, and category are deliberately *not* tags (they live in their own fields); `high-protein` is computed from macros, never hand-applied. |

### Ingredient database — `src/data/ingredients.yaml`

Normalized item → per-100g macros + grams-per-unit for every unit that item is actually used
with across recipes. Each entry cites its `source` (`usda`, `brand:NAME`, `estimate`). Used two
ways: recomputing recipe macros during audits, and merging cross-unit duplicates on the
shopping list. Recipe quantities are raw/as-purchased amounts, so macros are on the same raw
basis.

### Menu tracker — `src/data/menu.yaml`

The master "what do we eat" wishlist. `/menu/` cross-checks each item's `recipe` slug against
the live collection at build time — a renamed or removed recipe reverts to an open gap instead
of becoming a dead link.

## Pages

- `/` — searchable, sortable recipe grid plus the "Tonight's suggestion" widget, which picks a
  random non-breakfast main and pairs it with a base and/or side, preferring same-cuisine
  matches (with an affinity map so e.g. Tex-Mex mains draw Mexican sides) before falling back
  to universals.
- `/recipes/<slug>/` — full recipe with scaling control, cooking mode, grouped ingredients,
  steps, macros, notes.
- `/shopping-list/` — the aggregator described above.
- `/menu/` — wishlist coverage tracker.
- `/tags/<tag>/` — per-tag recipe grids, generated from the controlled vocabulary.

## Development

Requires Node >= 22.12.

```sh
npm install
npm run dev        # local dev server
npm run check      # cross-recipe data consistency checks (also runs ahead of build)
npm run build      # data checks + static build into dist/
npm run smoke      # shopping-list smoke tests against the real built bundle (build first)
npx wrangler dev   # preview the built site in the Workers runtime
npx wrangler deploy
```

`npm run generate-types` refreshes Wrangler's generated types after config changes.

### Adding a recipe

Drop a markdown file in `src/content/recipes/` — the filename becomes the slug. The schema
will fail the build unless exactly one ingredient is `primary: true`, and units/sections/tags
come from the controlled lists in `content.config.ts`. Things worth getting right that the
schema can't check for you:

- Set `category` and `self_contained` honestly — bad values produce bad meal suggestions
  (a soup that isn't `self_contained` gets mashed potatoes suggested under it).
- If an ingredient is new, add it to `ingredients.yaml` with macros and grams-per-unit for the
  units you used — `npm run check` fails the build if a recipe item is missing from the database.
- One item name = one grocery product. Fresh and dried forms get separate items (`thyme` vs
  `fresh thyme`, same convention as `spinach` vs `baby spinach`); the check enforces this by
  requiring every item name to map to a single store section across all recipes.
- Mark to-taste/garnish lines `scale: false` so they don't triple on a 3x batch.
- Reference every listed ingredient in at least one step (this is audited periodically).

## Project conventions

[TODO.md](TODO.md) is the working roadmap, run off periodic self-grading passes rather than a
feature wishlist. Audits (macro accuracy, tag hygiene, ingredient/step consistency) get logged
there with what was found and what was deliberately left alone. Client-side behavior is
verified by extracting the actual bundled scripts from a real build and running them against
real data — not by testing a parallel reimplementation. `npm run smoke` does exactly that for
the shopping list.
