// Cooking Mode step-view smoke test in the repo's real-execution style: runs the ACTUAL
// inline Cooking Mode script out of a built recipe page in Node's vm against a minimal mock
// DOM and a fake localStorage, and checks the per-step ingredient lists the build rendered.
// Covers enter/exit, the ingredients page, Back/Next, arrow keys, swipe, the timer tray's
// jump-to-step event, resuming on reload, and Done.
//
// Run `npm run build` first, then `npm run smoke`.

import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

if (!vm.SourceTextModule) {
  console.error('smoke: run via `npm run smoke` (node needs --experimental-vm-modules).');
  process.exit(1);
}
if (!existsSync('dist/client/recipes')) {
  console.error('smoke: no build output found -- run `npm run build` first.');
  process.exit(1);
}

let failures = 0;
const assert = (cond, label) => {
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + label);
  if (!cond) failures++;
};

const pageOf = (slug) => readFileSync(`dist/client/recipes/${slug}/index.html`, 'utf8');

// --- 1. per-step ingredient lists, as rendered ---
const stepIngredients = (slug) => {
  const ol = pageOf(slug).match(/<ol id="steps">([\s\S]*?)<\/ol>/)[1];
  return ol.split('<p class="step-text">').slice(1).map((li) =>
    [...li.matchAll(/<span class="qty">[^<]*<\/span> <span>([^<]*)<\/span>/g)].map((m) => m[1]));
};
const calabaza = stepIngredients('calabaza-con-pollo');
assert(calabaza[2].includes('calabaza squash') && calabaza[2].includes('yellow onion'), 'a distinctive word matches ("calabaza", "onion")');
assert(calabaza[3].includes('corn kernels') && calabaza[3].includes('tomato sauce'), 'step 4 lists corn kernels and tomato sauce');
assert(!calabaza[3].includes('tomato'), '"tomato sauce" does not also count as "tomato"');
assert(stepIngredients('gochujang-chicken-stir-fry')[0].includes('soy sauce'), '"soy" finds soy sauce');

// --- 2. run the shipped Cooking Mode script against a recipe page ---
const slug = 'coleslaw';
const html = pageOf(slug);
const script = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .find((s) => s.includes('recipes-chrisdlg:cook-page'));
assert(Boolean(script), 'Cooking Mode script is present in the built page');
const stepCount = html.split('<p class="step-text">').length - 1;

function classList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach((x) => set.add(x)),
    remove: (...c) => c.forEach((x) => set.delete(x)),
    contains: (c) => set.has(c),
    toggle: (c, force) => ((force ?? !set.has(c)) ? set.add(c) : set.delete(c)),
  };
}
function el(extra = {}) {
  const listeners = {};
  return {
    textContent: '',
    style: {},
    dataset: {},
    disabled: false,
    classList: classList(),
    setAttribute() {},
    addEventListener: (ev, fn) => (listeners[ev] = fn),
    fire: (ev, e = {}) => listeners[ev]?.(e),
    ...extra,
  };
}

const storage = new Map();
const PAGE_KEY = `recipes-chrisdlg:cook-page:/recipes/${slug}/`;

async function loadPage() {
  const steps = Array.from({ length: stepCount }, () => el());
  const ids = {
    'cooking-mode-toggle': el(),
    'cooking-mode-status': el(),
    'cook-prev': el(),
    'cook-next': el(),
    'cook-page-label': el(),
    'cook-progress-bar': el(),
  };
  const docListeners = {};
  const document = {
    body: el(),
    visibilityState: 'visible',
    getElementById: (id) => ids[id] ?? null,
    querySelectorAll: (sel) => {
      if (sel !== '#steps > li') throw new Error('unexpected selector ' + sel);
      return steps;
    },
    addEventListener: (ev, fn) => (docListeners[ev] = fn),
  };
  const context = {
    document,
    location: { pathname: `/recipes/${slug}/` },
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
    },
    navigator: {}, // no wake lock: Cooking Mode must still work without one
    scrollTo: () => {},
    console,
  };
  vm.createContext(context);
  const mod = new vm.SourceTextModule(script, { context });
  await mod.link(() => { throw new Error('Cooking Mode script should have no imports'); });
  await mod.evaluate();

  const touch = (x, y) => ({ changedTouches: [{ clientX: x, clientY: y }] });
  return {
    ...ids,
    body: document.body,
    steps,
    key: (key, tagName = 'BODY') => docListeners.keydown({ key, target: { tagName } }),
    swipe: (x0, y0, x1, y1) => { docListeners.touchstart(touch(x0, y0)); docListeners.touchend(touch(x1, y1)); },
    goto: (detail) => docListeners['cook:goto']({ detail }),
    current: () => document.body.dataset.cookPage,
  };
}

let p = await loadPage();
p.key('ArrowRight');
assert(p.current() === undefined, 'arrow keys do nothing outside Cooking Mode');

p['cooking-mode-toggle'].fire('click');
assert(p.body.classList.contains('cooking-mode') && p.current() === '0', 'Cooking Mode opens on the ingredients page');
assert(p['cook-page-label'].textContent === 'Ingredients' && p['cook-prev'].disabled, 'ingredients page: labelled, Back disabled');
assert(p['cook-next'].textContent === 'Start cooking →', 'ingredients page: Next reads "Start cooking"');

p['cook-next'].fire('click');
assert(p.current() === '1' && p.steps[0].classList.contains('current'), 'Next shows step 1');
assert(p['cook-page-label'].textContent === `Step 1 of ${stepCount}`, `label reads "Step 1 of ${stepCount}"`);
assert(p['cook-progress-bar'].style.width === `${100 / stepCount}%`, 'progress bar advances');
assert(p.steps.filter((s) => s.classList.contains('current')).length === 1, 'exactly one step is current');

p.key('ArrowRight');
assert(p.current() === '2', 'ArrowRight goes forward');
p.key('ArrowLeft');
assert(p.current() === '1', 'ArrowLeft goes back');
p.key('ArrowRight', 'INPUT');
assert(p.current() === '1', 'arrow keys typed into an input are ignored');

p.swipe(300, 100, 100, 110);
assert(p.current() === '2', 'a left swipe goes forward');
p.swipe(100, 100, 300, 105);
assert(p.current() === '1', 'a right swipe goes back');
p.swipe(200, 100, 260, 400);
assert(p.current() === '1', 'a mostly-vertical drag (scrolling) does not turn the page');

p.goto(stepCount);
assert(p.current() === String(stepCount) && p['cook-next'].textContent === 'Done ✓', 'the timer tray jump lands on the last step, Next reads Done');

// reload mid-recipe: Cooking Mode and the step are both restored
p = await loadPage();
assert(p.body.classList.contains('cooking-mode') && p.current() === String(stepCount), 'a reload resumes Cooking Mode on the same step');

p['cook-next'].fire('click');
assert(!p.body.classList.contains('cooking-mode'), 'Done exits Cooking Mode');
assert(storage.get(PAGE_KEY) === '0', 'and the next cook starts from the ingredients again');

process.exit(failures ? 1 : 0);
