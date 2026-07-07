import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const UNITS = ['lb', 'oz', 'fl_oz', 'g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'pinch', 'count'] as const;
const SECTIONS = ['meat', 'produce', 'dairy', 'pantry', 'frozen', 'bakery', 'other'] as const;
// controlled vocabulary only: dish format + objectively-checkable prep/dietary facts.
// deliberately excludes protein/ingredient (redundant with the primary ingredient already
// shown on the card), cuisine (its own field), and category (main/base/side is its own
// field too) so nothing gets tagged in two places. high-protein isn't here either: it's
// computed from macros_per_serving.protein_g instead of applied by feel.
const TAGS = [
  'bowl', 'stew', 'soup', 'chili', 'stir-fry', 'pasta', 'sheet-pan', 'tacos',
  'air-fryer', 'instant-pot', 'braise', 'baking', 'breakfast',
  'batch-prep', 'weeknight', 'slow-cooker', 'vegetarian', 'vegan', 'spicy',
] as const;

const ingredient = z.object({
  item: z.string(),
  qty: z.number(),
  unit: z.enum(UNITS),
  prep: z.string().optional(),
  // marks the ingredient the scale factor anchors on: exactly one per recipe
  primary: z.boolean().optional().default(false),
  // false = fixed regardless of scale factor (aromatics-to-taste, salt, garnish)
  scale: z.boolean().optional().default(true),
  // store-aisle grouping, used later for the shopping-list generator (Phase 3)
  section: z.enum(SECTIONS),
  // recipe sub-component this ingredient belongs to, e.g. "sauce", "pickle", "marinade";
  // undefined means it's part of the main dish
  group: z.string().optional(),
});

const recipe = z.object({
  title: z.string(),
  description: z.string().optional(),
  cuisine: z.string().optional(),
  // main = protein-forward dish; base = starchy anchor paired under a main (rice, beans,
  // potatoes); side = other accompaniment (vegetable, salad, bread); snack = snacks and
  // condiments not meant to anchor a meal on their own; sauce = a component tossed with a
  // protein rather than a dish in its own right (never auto-paired as a base/side).
  // Drives shopping-list pairing and stops a side's macros being read as a full meal.
  category: z.enum(['main', 'base', 'side', 'snack', 'sauce']).optional().default('main'),
  // where the recipe came from. family marks personal/sentimental recipes (kept verbatim,
  // never "optimized") so they read differently from web/Budget Bytes pulls.
  source: z.enum(['original', 'budget-bytes', 'web', 'family']).optional().default('original'),
  // when this gets cooked: any = year-round, hot/cold = seasonal
  season: z.enum(['any', 'hot', 'cold']).optional().default('any'),
  // true for a main that shouldn't be paired with a starchy base: either it already
  // includes its own (pasta, gnocchi, quinoa) or it's a soup, already a complete bowl on
  // its own. A side (bread, slaw) is still fine either way; only the base pool is skipped.
  self_contained: z.boolean().optional().default(false),
  tags: z.array(z.enum(TAGS)).optional().default([]),
  base_servings: z.number().optional().default(1),
  ingredients: z.array(ingredient).refine(
    (list) => list.filter((i) => i.primary).length === 1,
    { message: 'exactly one ingredient must be marked primary: true' },
  ),
  steps: z.array(z.string()),
  macros_per_serving: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
    // Phase 1: hand-entered. Phase 2: computed from ingredients.yaml, same shape either way.
    source: z.enum(['manual', 'computed']).optional().default('manual'),
  }).optional(),
  notes: z.string().optional(),
  created: z.coerce.date(),
  made_log: z.array(z.coerce.date()).optional().default([]),
});

const recipes = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/recipes',
    generateId: ({ entry }) => entry.replace(/\.mdx?$/, ''),
  }),
  schema: recipe,
});

export const collections = { recipes };
