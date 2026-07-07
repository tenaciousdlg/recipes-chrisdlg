export interface ScalableIngredient {
  item: string;
  qty: number;
  unit: string;
  prep?: string;
  primary: boolean;
  scale: boolean;
  section: string;
  group?: string;
}

export function getPrimaryIngredient<T extends ScalableIngredient>(ingredients: T[]): T {
  const primary = ingredients.find((i) => i.primary);
  if (!primary) throw new Error('recipe has no ingredient marked primary: true');
  return primary;
}

// scale factor = target amount of the primary ingredient / the recipe's base amount of it
export function scaleFactor(baseQty: number, targetQty: number): number {
  return targetQty / baseQty;
}

export function scaledQty(ingredient: ScalableIngredient, factor: number): number {
  return ingredient.scale ? ingredient.qty * factor : ingredient.qty;
}

export function scaledServings(baseServings: number, factor: number): number {
  return Math.round(baseServings * factor * 10) / 10;
}

// trims float noise (2.0000000001 -> 2) and caps display precision at 2 decimals
export function formatQty(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toString();
}
