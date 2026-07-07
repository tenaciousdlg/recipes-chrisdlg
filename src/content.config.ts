import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const UNITS = ['lb', 'oz', 'g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'count'] as const;
const SECTIONS = ['meat', 'produce', 'dairy', 'pantry', 'frozen', 'bakery', 'other'] as const;

const ingredient = z.object({
  item: z.string(),
  qty: z.number(),
  unit: z.enum(UNITS),
  prep: z.string().optional(),
  // marks the ingredient the scale factor anchors on — exactly one per recipe
  primary: z.boolean().optional().default(false),
  // false = fixed regardless of scale factor (aromatics-to-taste, salt, garnish)
  scale: z.boolean().optional().default(true),
  // store-aisle grouping, used later for the shopping-list generator (Phase 3)
  section: z.enum(SECTIONS),
  // recipe sub-component this ingredient belongs to, e.g. "sauce", "pickle", "marinade" —
  // undefined means it's part of the main dish
  group: z.string().optional(),
});

const recipe = z.object({
  title: z.string(),
  description: z.string(),
  cuisine: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  base_servings: z.number(),
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
    // Phase 1: hand-entered. Phase 2: computed from ingredients.yaml — same shape either way.
    source: z.enum(['manual', 'computed']),
  }),
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
