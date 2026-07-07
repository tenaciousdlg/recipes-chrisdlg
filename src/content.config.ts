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
  'bowl', 'stew', 'soup', 'stir-fry', 'pasta', 'sheet-pan',
  'batch-prep', 'weeknight', 'slow-cooker', 'vegetarian', 'spicy',
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
  // main = protein-forward dish; base/side = rice, beans, etc. paired under a main.
  // Drives shopping-list pairing and stops a side's macros being read as a full meal.
  category: z.enum(['main', 'base', 'side']).optional().default('main'),
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
