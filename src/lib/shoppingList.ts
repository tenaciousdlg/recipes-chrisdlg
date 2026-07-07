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

// sums quantities across recipes for the same item+unit pair; different units for the
// same item (e.g. garlic by count vs. garlic by tbsp minced) stay as separate lines
// since converting between them needs the ingredient DB from Phase 2, not built yet
export function aggregateIngredients(selected: SelectedRecipe[]): AggregatedLine[] {
  const lines = new Map<string, AggregatedLine>();
  for (const recipe of selected) {
    const factor = scaleFactor(recipe.primaryQty, recipe.targetQty);
    for (const ingredient of recipe.ingredients) {
      const qty = scaledQty(ingredient, factor);
      const key = `${ingredient.item}::${ingredient.unit}`;
      const existing = lines.get(key);
      if (existing) {
        existing.qty += qty;
        if (!existing.recipes.includes(recipe.title)) existing.recipes.push(recipe.title);
      } else {
        lines.set(key, {
          item: ingredient.item,
          unit: ingredient.unit,
          qty,
          section: ingredient.section,
          recipes: [recipe.title],
        });
      }
    }
  }
  return Array.from(lines.values());
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
