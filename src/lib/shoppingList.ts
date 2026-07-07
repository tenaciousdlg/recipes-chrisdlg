import { scaleFactor, scaledQty, type ScalableIngredient } from './scale';

const SECTION_ORDER = ['produce', 'meat', 'dairy', 'frozen', 'bakery', 'pantry', 'other'] as const;

export interface SelectedRecipe {
  title: string;
  primaryQty: number;
  targetQty: number;
  ingredients: ScalableIngredient[];
}

export interface AggregatedLine {
  item: string;
  unit: string;
  qty: number;
  section: string;
  recipes: string[];
}

export interface SectionGroup {
  section: string;
  lines: AggregatedLine[];
}

// item -> unit -> grams per one unit, e.g. { ginger: { tbsp: 6, tsp: 2 } }, sourced
// from src/data/ingredients.yaml's grams_per_unit. Optional: reconciling cross-unit
// duplicates only kicks in when this is provided and covers the units involved.
export type GramConversions = Record<string, Record<string, number>>;

// sums quantities across recipes for the same item+unit pair first (e.g. two recipes
// both using garlic by count just add). If the same item shows up in different units
// across recipes (e.g. ginger by tbsp in one, tsp in another), those stay as separate
// lines UNLESS `conversions` covers every unit involved, in which case they're merged
// via a common grams basis and re-expressed in the finest-grained contributing unit.
export function aggregateIngredients(selected: SelectedRecipe[], conversions?: GramConversions): AggregatedLine[] {
  const byItemUnit = new Map<string, AggregatedLine>();
  for (const recipe of selected) {
    const factor = scaleFactor(recipe.primaryQty, recipe.targetQty);
    for (const ingredient of recipe.ingredients) {
      const qty = scaledQty(ingredient, factor);
      const key = `${ingredient.item}::${ingredient.unit}`;
      const existing = byItemUnit.get(key);
      if (existing) {
        existing.qty += qty;
        if (!existing.recipes.includes(recipe.title)) existing.recipes.push(recipe.title);
      } else {
        byItemUnit.set(key, {
          item: ingredient.item,
          unit: ingredient.unit,
          qty,
          section: ingredient.section,
          recipes: [recipe.title],
        });
      }
    }
  }

  const byItem = new Map<string, AggregatedLine[]>();
  for (const line of byItemUnit.values()) {
    if (!byItem.has(line.item)) byItem.set(line.item, []);
    byItem.get(line.item)!.push(line);
  }

  const result: AggregatedLine[] = [];
  for (const lines of byItem.values()) {
    if (lines.length === 1) {
      result.push(lines[0]);
      continue;
    }
    const itemConversions = conversions?.[lines[0].item];
    const canReconcile = itemConversions && lines.every((l) => itemConversions[l.unit] !== undefined);
    if (!canReconcile) {
      result.push(...lines);
      continue;
    }
    const totalGrams = lines.reduce((sum, l) => sum + l.qty * itemConversions[l.unit], 0);
    const finestUnit = lines
      .map((l) => l.unit)
      .reduce((a, b) => (itemConversions[a] <= itemConversions[b] ? a : b));
    const recipes = [...new Set(lines.flatMap((l) => l.recipes))];
    result.push({
      item: lines[0].item,
      unit: finestUnit,
      qty: totalGrams / itemConversions[finestUnit],
      section: lines[0].section,
      recipes,
    });
  }
  return result;
}

export function groupBySection(lines: AggregatedLine[]): SectionGroup[] {
  const groups = new Map<string, AggregatedLine[]>();
  for (const line of lines) {
    if (!groups.has(line.section)) groups.set(line.section, []);
    groups.get(line.section)!.push(line);
  }
  for (const group of groups.values()) group.sort((a, b) => a.item.localeCompare(b.item));
  return SECTION_ORDER.filter((section) => groups.has(section)).map((section) => ({
    section,
    lines: groups.get(section)!,
  }));
}
