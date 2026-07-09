// Cross-recipe data consistency checks the zod schema can't express (it validates one
// recipe at a time; these are invariants across the whole collection plus ingredients.yaml).
// Run standalone via `npm run check`; also runs ahead of `astro build` so drift fails the
// build the same way a schema violation would.
//
// 1. An item name maps to exactly one store section across all recipes. Fresh vs. dried
//    herbs sharing a name is how the oregano/thyme bug happened: ingredients.yaml covered
//    both units, so the shopping list merged a fresh sprig with dried flakes into one line
//    under an arbitrary aisle. Different grocery products get different item names — see
//    'baby spinach' in ingredients.yaml for the join-key convention.
// 2. Every recipe item exists in ingredients.yaml, so macro recomputation and cross-unit
//    shopping-list merging always have full coverage.

import { readFileSync, readdirSync } from 'node:fs';
import { load } from 'js-yaml';

const db = load(readFileSync('src/data/ingredients.yaml', 'utf8'));
const recipesDir = 'src/content/recipes';
const recipeFiles = readdirSync(recipesDir).filter((f) => /\.mdx?$/.test(f));

const itemSections = new Map(); // item -> Map(section -> recipe files using it there)

for (const file of recipeFiles) {
  const raw = readFileSync(`${recipesDir}/${file}`, 'utf8');
  const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/);
  const data = load(frontmatter[1]);
  for (const ing of data.ingredients) {
    if (!itemSections.has(ing.item)) itemSections.set(ing.item, new Map());
    const sections = itemSections.get(ing.item);
    if (!sections.has(ing.section)) sections.set(ing.section, []);
    sections.get(ing.section).push(file);
  }
}

const errors = [];

for (const [item, sections] of itemSections) {
  if (sections.size > 1) {
    const detail = [...sections].map(([s, files]) => `${s} (${files.join(', ')})`).join(' vs ');
    errors.push(`'${item}' is filed under conflicting store sections: ${detail}`);
  }
}

for (const item of itemSections.keys()) {
  if (!db[item]) errors.push(`'${item}' is missing from src/data/ingredients.yaml`);
}

if (errors.length) {
  console.error('data check failed:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `data check passed: ${itemSections.size} items across ${recipeFiles.length} recipes, ` +
    'sections consistent, ingredients.yaml coverage complete.',
);
