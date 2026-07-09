// Shopping-list smoke test in the repo's real-execution style: loads the ACTUAL bundled
// script out of dist/ (not a parallel reimplementation of it) and runs it in Node's vm
// against a minimal mock DOM, real recipe data from the built page, and a fake
// localStorage. Covers select/render, the empty-qty-box hold, retyping, Clear all, and
// the fresh/dried herb separation on the aggregated list.
//
// Run `npm run build` first, then `npm run smoke` (needs --experimental-vm-modules for
// linking the bundle's ES-module import of the shared scale chunk).

import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

if (!vm.SourceTextModule) {
  console.error('smoke: run via `npm run smoke` (node needs --experimental-vm-modules).');
  process.exit(1);
}

const pageHtml = 'dist/client/shopping-list/index.html';
if (!existsSync(pageHtml)) {
  console.error('smoke: no build output found -- run `npm run build` first.');
  process.exit(1);
}

const html = readFileSync(pageHtml, 'utf8');
const bundlePath = html.match(/src="(\/_astro\/shopping-list[^"]*)"/)[1];
const script = readFileSync('dist/client' + bundlePath, 'utf8');

// the embedded JSON data blobs, exactly as the built page ships them
const jsonOf = (id) => {
  const m = html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`));
  return m[1];
};
const recipesJson = jsonOf('recipes-data');
const recipes = JSON.parse(recipesJson);

// --- minimal mock DOM: only what the shopping-list script actually touches ---
function el(extra = {}) {
  return {
    textContent: '',
    innerHTML: '',
    style: {},
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
    dispatch(ev, evt) { (this.listeners[ev] ?? []).forEach((fn) => fn(evt)); },
    ...extra,
  };
}

const checks = new Map();
const qtys = new Map();
for (const r of recipes) {
  checks.set(r.id, el({ dataset: { id: r.id }, checked: false }));
  qtys.set(r.id, el({ dataset: { id: r.id }, value: String(r.primaryQty) }));
}

// picker rows with the REAL data-search attributes the server rendered into the built
// page, so the search test exercises the shipped index, not a fabricated one
const rowEls = new Map();
for (const m of html.matchAll(/class="picker-row" data-search="([^"]*)"[\s\S]*?data-id="([^"]+)"/g)) {
  rowEls.set(m[2], el({ dataset: { search: m[1] } }));
}

const picker = el({
  querySelectorAll(sel) {
    if (sel.includes('recipe-check')) return { forEach: (fn) => [...checks.values()].forEach(fn) };
    if (sel.includes('recipe-qty')) return { forEach: (fn) => [...qtys.values()].forEach(fn) };
    if (sel.includes('picker-row')) return { forEach: (fn) => [...rowEls.values()].forEach(fn) };
    throw new Error('unexpected selector ' + sel);
  },
  querySelector(sel) {
    const id = sel.match(/data-id="([^"]+)"/)[1];
    if (sel.includes('recipe-qty')) return qtys.get(id);
    if (sel.includes('recipe-check')) return checks.get(id);
    throw new Error('unexpected selector ' + sel);
  },
});

const byId = {
  'recipes-data': el({ textContent: recipesJson }),
  'gram-conversions-data': el({ textContent: jsonOf('gram-conversions-data') }),
  'recipe-picker': picker,
  'shopping-list-output': el(),
  'empty-state': el(),
  'copy-list': el(),
  'copy-confirm': el(),
  'clear-all': el(),
  'picker-search': el({ value: '' }),
};

const storage = new Map();
let copiedText = null;
const context = {
  document: { getElementById: (id) => byId[id] },
  localStorage: {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
  },
  navigator: { clipboard: { writeText: (t) => { copiedText = t; return Promise.resolve(); } } },
  setTimeout: () => {},
  console,
};
vm.createContext(context);
const mod = new vm.SourceTextModule(script, { context });
await mod.link((specifier) => {
  const dep = readFileSync('dist/client/_astro/' + specifier.replace('./', ''), 'utf8');
  return new vm.SourceTextModule(dep, { context });
});
await mod.evaluate();

const output = byId['shopping-list-output'];
const target = recipes[0];

let failures = 0;
const assert = (cond, label) => {
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + label);
  if (!cond) failures++;
};

// 1. check a recipe with its default qty -> it renders
checks.get(target.id).checked = true;
picker.dispatch('change');
assert(output.innerHTML.includes(target.title), 'checked recipe appears in the list');

// 2. empty the qty box mid-edit -> recipe stays, holding the last good qty
qtys.get(target.id).value = '';
picker.dispatch('input');
assert(output.innerHTML.includes(target.title), 'recipe stays on the list while qty box is empty');
const persisted = JSON.parse(storage.get('recipes-chrisdlg:shopping-list'));
assert(persisted[target.id].qty === target.primaryQty, 'persisted qty holds last good value (not null/NaN)');

// 3. type a new qty -> scaling updates off the new value
qtys.get(target.id).value = String(target.primaryQty * 2);
picker.dispatch('input');
const doubled = JSON.parse(storage.get('recipes-chrisdlg:shopping-list'));
assert(doubled[target.id].qty === target.primaryQty * 2, 'new typed qty takes effect');

// 4. clear all -> empty state back, storage reset
byId['clear-all'].dispatch('click');
assert(output.innerHTML === '' && byId['empty-state'].style.display === 'block', 'clear-all resets the list');

// 5. herb split regression: tortilla soup (fresh oregano sprig) + marinara (dried oregano
//    tsp) must produce two separate lines, never one merged product
const soup = recipes.find((r) => r.title.includes('Tortilla'));
const marinara = recipes.find((r) => r.title.includes('Marinara'));
checks.get(soup.id).checked = true;
checks.get(marinara.id).checked = true;
picker.dispatch('change');
const oreganoItems = output.innerHTML.match(/data-item="(?:fresh )?oregano"/g) ?? [];
assert(
  oreganoItems.length === 2 && new Set(oreganoItems).size === 2,
  `fresh + dried oregano stay separate lines (found: ${oreganoItems.join(', ') || 'none'})`,
);

// 6. the user's real scenario: both Greek recipes together. Count items display without
//    the word "count", and fractional count produce rounds up with the exact need shown.
byId['clear-all'].dispatch('click');
const salad = recipes.find((r) => r.title.includes('Cucumber-Tomato'));
const chicken = recipes.find((r) => r.title.includes('Greek Yogurt-Marinated'));
checks.get(salad.id).checked = true;
checks.get(chicken.id).checked = true;
picker.dispatch('change');
assert(!output.innerHTML.includes(' count'), 'the word "count" never appears as a display unit');
assert(output.innerHTML.includes('need 1/4'), 'quarter red onion rounds up to a whole one with the need shown');

// 7. picker search: real server-rendered data-search attributes drive the filter
byId['picker-search'].value = 'greek';
byId['picker-search'].dispatch('input');
const potRoast = recipes.find((r) => r.title === 'Pot Roast');
assert(
  rowEls.get(salad.id).style.display === '' && rowEls.get(potRoast.id).style.display === 'none',
  'searching "greek" keeps Greek rows visible and hides Pot Roast',
);
assert(output.innerHTML.includes(salad.title), 'checked recipes stay on the list while filtered out of view');

// 8. pantry-lite: mark red onion "have it" -> struck in the list, dropped from the copy
byId['shopping-list-output'].dispatch('change', {
  target: {
    classList: { contains: (c) => c === 'have-check' },
    dataset: { item: 'red onion' },
    checked: true,
  },
});
assert(output.innerHTML.includes('have-it'), 'have-it line is marked in the rendered list');
assert(JSON.parse(storage.get('recipes-chrisdlg:pantry'))['red onion'] === true, 'pantry state persists to localStorage');
byId['copy-list'].dispatch('click');
assert(
  copiedText !== null && !copiedText.includes('red onion') && copiedText.includes('cucumber'),
  'copied list skips have-it items but keeps the rest',
);
assert(copiedText !== null && copiedText.includes('- 1 lemon'), 'copied count lines read like "- 1 lemon"');

process.exit(failures ? 1 : 0);
