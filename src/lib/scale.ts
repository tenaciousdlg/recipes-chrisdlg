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

// standard kitchen measuring increments (cups/spoons come in these fractions; fifths etc.
// don't correspond to any real measuring tool, so they're deliberately not here)
const FRACTIONS: Array<[number, string]> = [
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
];

// how the unit reads to a human: 'count' disappears entirely ("1 lemon", not
// "1 count lemon") and fl_oz gets its space back; everything else is already fine
export function unitLabel(unit: string): string {
  if (unit === 'count') return '';
  if (unit === 'fl_oz') return 'fl oz';
  return unit;
}

// quantity + unit as a person reads it: "1 1/4 lb", "3 tbsp", or a bare "2" for count items
export function formatMeasure(qty: number, unit: string): string {
  const label = unitLabel(unit);
  return label ? `${formatQty(qty)} ${label}` : formatQty(qty);
}

// trims float noise (2.0000000001 -> 2) and displays as a mixed-number fraction when the
// fractional part is close to a standard kitchen measurement (1/2, 1/3, 1/4, ...); falls
// back to a decimal, capped at 2 places, for anything that doesn't land near one of those
export function formatQty(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  if (frac < 0.01) return whole.toString();
  if (frac > 0.99) return (whole + 1).toString();
  for (const [value, label] of FRACTIONS) {
    if (Math.abs(frac - value) < 0.02) {
      return whole > 0 ? `${whole} ${label}` : label;
    }
  }
  return (Math.round(n * 100) / 100).toString();
}
