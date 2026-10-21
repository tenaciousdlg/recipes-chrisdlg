// Cooking Mode's step view shows, under each step, the ingredients that step mentions, so
// you aren't flipping back to the list mid-step. Matching is by name in the step's text, in
// two passes:
//   1. the full item or its plural/singular ("eggs" <-> "egg"), longest names first, and
//      each match blanks its text so "tomato sauce" can't also count as "tomato";
//   2. for items still unmatched, a distinctive single word of the name ("calabaza" for
//      "calabaza squash", "corn" for "corn kernels", "onion" for "yellow onion"): one no
//      other ingredient in the recipe shares, at least 3 letters ("soy"), not a descriptor.

interface Named {
  item: string;
}

// words that describe rather than name an ingredient: never enough on their own
const DESCRIPTORS = new Set([
  'black', 'white', 'red', 'green', 'yellow', 'brown', 'fresh', 'dried', 'large', 'small',
  'ground', 'frozen', 'canned', 'boneless', 'skinless', 'whole', 'light', 'dark', 'sweet',
]);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function variants(name: string): string[] {
  const out = new Set([name]);
  if (name.endsWith('es')) out.add(name.slice(0, -2));
  if (name.endsWith('s')) out.add(name.slice(0, -1));
  else out.add(name + 's');
  // longest first, so "eggs" is blanked whole rather than leaving a stray "s"
  return [...out].sort((a, b) => b.length - a.length);
}

export function stepIngredients<T extends Named>(step: string, ingredients: T[]): T[] {
  let text = step.toLowerCase();
  const matched = new Set<T>();

  // true if any variant of the name is in the remaining text; blanks what it finds
  const take = (name: string) => {
    let hit = false;
    for (const v of variants(name)) {
      const re = new RegExp(`\\b${escape(v)}\\b`, 'g');
      if (re.test(text)) {
        hit = true;
        text = text.replace(re, (m) => ' '.repeat(m.length));
      }
    }
    return hit;
  };

  const byLength = [...ingredients].sort((a, b) => b.item.length - a.item.length);
  for (const ing of byLength) if (take(ing.item.toLowerCase())) matched.add(ing);

  const wordsOf = (ing: T) => ing.item.toLowerCase().split(/\s+/);
  const owners = new Map<string, number>();
  for (const ing of ingredients) for (const w of new Set(wordsOf(ing))) owners.set(w, (owners.get(w) ?? 0) + 1);

  for (const ing of byLength) {
    if (matched.has(ing)) continue;
    const words = wordsOf(ing);
    if (words.length < 2) continue;
    const distinctive = words.filter((w) => w.length >= 3 && !DESCRIPTORS.has(w) && owners.get(w) === 1);
    if (distinctive.some((w) => take(w))) matched.add(ing);
  }

  // recipe order, which is the order the ingredient list shows them in
  return ingredients.filter((ing) => matched.has(ing));
}
