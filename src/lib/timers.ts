// Step timers: finds durations in a step's text ("~5 min", "15-20 min", "1.5 hours",
// "15 to 20 minutes", "30 sec") so the recipe page can render each one as a tappable
// countdown. Shared by the server render (splitting the step) and the client script
// (formatting the countdown).

export type StepPart = string | { text: string; seconds: number };

const UNIT_SECONDS: Array<[RegExp, number]> = [
  [/^h/i, 3600],
  [/^m/i, 60],
  [/^s/i, 1],
];

// an optional "~" (kept inside the button so it can't wrap away from its number), a number,
// an optional range end ("-", en dash, or "to"), then a unit. "or" is NOT a range ("high
// 4-5 hrs or low 8 hrs" is two separate times). No bare "h"/"m": too easy to hit words, and
// no recipe writes times that way.
const DURATION =
  /(?:~\s*)?\b(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|min(?:ute)?s?|sec(?:ond)?s?)\b/gi;

function unitSeconds(unit: string): number {
  return UNIT_SECONDS.find(([re]) => re.test(unit))![1];
}

// a range sets the timer to its LOW end: the step's "until golden" check is what decides
// done, and the alarm should come before the earliest point that check can pass, not after
export function splitTimers(step: string): StepPart[] {
  const parts: StepPart[] = [];
  let last = 0;
  for (const m of step.matchAll(DURATION)) {
    const seconds = Math.round(parseFloat(m[1]) * unitSeconds(m[3]));
    if (seconds <= 0) continue;
    if (m.index! > last) parts.push(step.slice(last, m.index));
    parts.push({ text: m[0], seconds });
    last = m.index! + m[0].length;
  }
  if (last < step.length) parts.push(step.slice(last));
  return parts;
}

// countdown display: m:ss under an hour, h:mm:ss above
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
