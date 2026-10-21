// Step-timer smoke test in the repo's real-execution style: checks the timer buttons the
// build actually rendered into every recipe page, then runs the ACTUAL inline timer script
// out of a built page in Node's vm against a minimal mock DOM, a fake clock, and a fake
// localStorage. Covers start, countdown, reload persistence, cancel (with its confirm),
// the finished alarm, dismiss, and the tab-title countdown.
//
// Run `npm run build` first, then `npm run smoke`.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { load as parseYaml } from 'js-yaml';

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
const buttonsIn = (html) =>
  [...html.matchAll(/<button type="button" class="step-timer" data-timer-id="([^"]+)" data-seconds="(\d+)" data-label="([^"]+)"/g)]
    .map((m) => ({ id: m[1], seconds: Number(m[2]), label: m[3] }));
const decode = (s) =>
  s.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// --- 1. what the build rendered, across every recipe ---
const slugs = readdirSync('src/content/recipes').map((f) => f.replace(/\.md$/, ''));
const all = [];
let textIntact = true;
for (const slug of slugs) {
  const html = pageOf(slug);
  for (const b of buttonsIn(html)) all.push({ slug, ...b });
  // the step must still read exactly as written: buttons wrap durations, never alter text
  const steps = parseYaml(readFileSync(`src/content/recipes/${slug}.md`, 'utf8').split('---')[1]).steps;
  const ol = html.match(/<ol id="steps">([\s\S]*?)<\/ol>/)[1];
  const rendered = [...ol.matchAll(/<p class="step-text">([\s\S]*?)<\/p>/g)].map((m) => decode(m[1]));
  if (rendered.length !== steps.length || rendered.some((t, i) => t !== steps[i])) {
    textIntact = false;
    console.log(`  step text changed in ${slug}`);
  }
}
const secondsFor = (label) => all.find((b) => b.label === label)?.seconds;
assert(textIntact, 'every step renders with its original text intact');
assert(new Set(all.map((b) => b.slug)).size >= 45, `most recipes get timers (${new Set(all.map((b) => b.slug)).size} of ${slugs.length})`);
assert(secondsFor('30 min') === 1800, '"30 min" -> 30:00');
assert(secondsFor('1.5 hours') === 5400, '"1.5 hours" -> 1:30:00');
assert(secondsFor('15 to 20 minutes') === 900, '"15 to 20 minutes" range starts at its low end');
assert(secondsFor('30 sec') === 30, '"30 sec" -> 0:30');
assert(secondsFor('4-5 hrs') === 4 * 3600, '"4-5 hrs" -> 4 hours');
assert(!all.some((b) => / or /.test(b.label)), '"or" never joins two times into one range');

// --- 2. run the shipped timer script against a recipe page ---
const slug = 'coleslaw';
const html = pageOf(slug);
const script = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .find((s) => s.includes('recipes-chrisdlg:timers'));
assert(Boolean(script), 'timer script is present in the built page');

function classList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach((x) => set.add(x)),
    remove: (...c) => c.forEach((x) => set.delete(x)),
    contains: (c) => set.has(c),
  };
}

const storage = new Map();
let clock = 1_000_000;

async function loadPage({ confirmAnswer = () => true } = {}) {
  const buttons = buttonsIn(html).map((b) => {
    const btn = {
      dataset: { timerId: b.id, seconds: String(b.seconds), label: b.label },
      textContent: b.label,
      classList: classList(),
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      closest() { return this; },
    };
    return btn;
  });
  const listeners = {};
  const list = {
    addEventListener: (ev, fn) => (listeners[ev] = fn),
    querySelector: (sel) => buttons.find((b) => sel.includes(`"${b.dataset.timerId}"`)) ?? null,
  };
  const trayListeners = {};
  const tray = {
    children: [],
    appendChild(c) { this.children.push(c); c.parent = this; },
    addEventListener: (ev, fn) => (trayListeners[ev] = fn),
  };
  const docListeners = {};
  const dispatched = [];
  const document = {
    title: 'Coleslaw',
    visibilityState: 'visible',
    getElementById: (id) => ({ steps: list, 'timer-tray': tray })[id] ?? null,
    addEventListener: (ev, fn) => (docListeners[ev] = fn),
    dispatchEvent: (e) => dispatched.push(e),
    createElement: () => ({
      dataset: {},
      classList: classList(),
      textContent: '',
      closest() { return this; },
      remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); },
    }),
  };
  const page = { buttons, document, tray, dispatched, vibrated: [], tick: null, cleared: false };
  const context = {
    document,
    location: { pathname: `/recipes/${slug}/` },
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
    },
    navigator: { vibrate: (p) => page.vibrated.push(p) },
    Date: { now: () => clock },
    setInterval: (fn) => { page.tick = fn; page.cleared = false; return 1; },
    clearInterval: () => { page.cleared = true; },
    confirm: confirmAnswer,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    console,
  };
  vm.createContext(context);
  const mod = new vm.SourceTextModule(script, { context });
  await mod.link(() => { throw new Error('timer script should have no imports'); });
  await mod.evaluate();
  page.tap = (btn) => listeners.click({ target: btn });
  page.tapChip = (c) => trayListeners.click({ target: c });
  page.advance = (ms) => { clock += ms; page.tick?.(); };
  return page;
}

const KEY = `recipes-chrisdlg:timers:/recipes/${slug}/`;
let page = await loadPage();
const [timer] = page.buttons; // coleslaw's "30 min" chill
assert(timer.dataset.seconds === '1800', 'coleslaw has its 30 min timer');

page.tap(timer);
assert(timer.classList.contains('running') && timer.textContent === '30:00', 'tap starts a 30:00 countdown');
assert(page.document.title === '⏱ 30:00 · Coleslaw', 'tab title shows the countdown');
page.advance(10 * 60 * 1000);
assert(timer.textContent === '20:00', 'ten minutes later it reads 20:00');
assert(JSON.parse(storage.get(KEY))[timer.dataset.timerId] === 1_000_000 + 1800 * 1000, 'end time persists');
const [chip] = page.tray.children;
assert(page.tray.children.length === 1 && chip.textContent === 'Step 4 · 20:00', 'the Cooking Mode tray shows "Step 4 · 20:00"');
page.tapChip(chip);
assert(page.dispatched.at(-1)?.type === 'cook:goto' && page.dispatched.at(-1).detail === 4, 'tapping the tray chip asks to jump to step 4');

// reload: a fresh page instance restores the running timer from storage
page = await loadPage({ confirmAnswer: () => false });
const reloaded = page.buttons[0];
assert(reloaded.classList.contains('running') && reloaded.textContent === '20:00', 'a reload restores the running timer at 20:00');

// cancel needs the confirm: a declined confirm keeps it running
page.tap(reloaded);
assert(reloaded.classList.contains('running'), 'declining the cancel confirm keeps it running');

page = await loadPage({ confirmAnswer: () => true });
const t = page.buttons[0];
page.tap(t);
assert(!t.classList.contains('running') && t.textContent === '30 min', 'confirmed cancel restores the label');
assert(JSON.stringify(JSON.parse(storage.get(KEY))) === '{}', 'cancel clears it from storage');
assert(page.document.title === 'Coleslaw', 'title returns to the recipe name');
assert(page.tray.children.length === 0, 'cancel removes the tray chip');

// run to completion: alarm state, vibration, interval stops
page.tap(t);
page.advance(1800 * 1000);
assert(t.classList.contains('done') && t.textContent === '30 min done', 'at zero it shows done');
assert(page.vibrated.length === 1, 'the phone vibrates once when it finishes');
assert(page.document.title === '⏰ done · Coleslaw', 'title flags the finished timer');
assert(page.cleared, 'the tick interval stops when nothing is running');
assert(page.tray.children[0]?.classList.contains('done') && page.tray.children[0].textContent === 'Step 4 · 30 min done', 'the tray chip turns into a done alarm');
assert(JSON.stringify(JSON.parse(storage.get(KEY))) === '{}', 'a finished timer is not restored on reload');
page.tap(t);
assert(!t.classList.contains('done') && t.textContent === '30 min' && page.document.title === 'Coleslaw', 'tap dismisses the alarm');
assert(page.tray.children.length === 0, 'dismissing clears the tray');

// a timer that ran out while the page was closed shows done on return
storage.set(KEY, JSON.stringify({ [t.dataset.timerId]: clock - 1000 }));
page = await loadPage();
assert(page.buttons[0].classList.contains('done'), 'a timer that expired while away shows done on load');

process.exit(failures ? 1 : 0);
