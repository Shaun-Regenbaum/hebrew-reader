import { createSignal } from 'solid-js';
import { markChanged } from './changes.ts';
import { addSeconds, type DayMap, dayKey, prune } from './daily.ts';
import { readJson, writeJson } from './prefs.ts';
import type { HabitDoc } from './sync.ts';

/**
 * The daily habit, on this device: the reading goal, the chosen topics, minutes read each day, and which
 * first-visit hints have been shown. Goal, topics and minutes sync with the rest of the learner's data; the
 * hints do not, because each device is new to the app once.
 */

/** When the goal and the topics were last chosen (ms), so the newest choice wins when devices are combined. */
const [stamps, setStamps] = createSignal<{ goal: number; topics: number }>(
  readJson('hr:stamps', { goal: 0, topics: 0 }),
);

/** One-time things: hints already shown, and the day the "done for today" screen last appeared. */
interface Flags {
  /** The learner has tapped a word. */
  tapped?: boolean;
  /** The learner has asked for a sentence translation. */
  translated?: boolean;
  /** We have already asked for a daily goal. */
  goalAsked?: boolean;
  /** The learner has been through the first visit. */
  started?: boolean;
  /** The day we last showed "done for today". */
  doneDay?: string;
}

const [goal, setGoalSignal] = createSignal<number | null>(readJson<number | null>('hr:goal', null));
const [topics, setTopicsSignal] = createSignal<string[] | null>(readJson<string[] | null>('hr:topics', null));
const [days, setDays] = createSignal<DayMap>(readJson<DayMap>('hr:days', {}));
const [flags, setFlags] = createSignal<Flags>(readJson<Flags>('hr:flags', {}));
/** True from the moment today's goal is reached until the learner closes the "done" screen. */
const [goalReached, setGoalReached] = createSignal(false);

export { days, flags, goal, goalReached, topics };

function stamp(which: 'goal' | 'topics'): void {
  const next = { ...stamps(), [which]: Date.now() };
  setStamps(next);
  writeJson('hr:stamps', next);
}

export function setGoal(minutes: number): void {
  setGoalSignal(minutes);
  writeJson('hr:goal', minutes);
  stamp('goal');
  markChanged();
}

export function setTopics(keys: string[]): void {
  setTopicsSignal(keys);
  writeJson('hr:topics', keys);
  stamp('topics');
  markChanged();
}

/** The habit as one piece of the synced document. */
export const habitSnapshot = (): HabitDoc => ({
  goal: goal(),
  goalAt: stamps().goal,
  topics: topics(),
  topicsAt: stamps().topics,
  days: days(),
});

/** Take a merged copy from sync. This is not a change the learner made, so it does not trigger a sync. */
export function applyHabit(h: HabitDoc): void {
  setGoalSignal(h.goal);
  writeJson('hr:goal', h.goal);
  setTopicsSignal(h.topics);
  writeJson('hr:topics', h.topics);
  const st = { goal: h.goalAt, topics: h.topicsAt };
  setStamps(st);
  writeJson('hr:stamps', st);
  setDays(h.days);
  writeJson('hr:days', h.days);
}

export function setFlag(key: Exclude<keyof Flags, 'doneDay'>): void {
  if (flags()[key]) return;
  const next = { ...flags(), [key]: true };
  setFlags(next);
  writeJson('hr:flags', next);
}

export const closeDone = () => setGoalReached(false);

/** Count reading time. When it brings the learner to today's goal for the first time, the "done" screen opens. */
export function addReading(seconds: number, now = new Date()): void {
  const r = addSeconds(days(), now, seconds, goal());
  const next = prune(r.days, now);
  setDays(next);
  writeJson('hr:days', next);
  // sync about every half minute of reading, and the moment the goal is met
  const secs = next[dayKey(now)]?.s ?? 0;
  if (r.reached || secs % 30 === 0) markChanged();
  if (r.reached && flags().doneDay !== dayKey(now)) {
    const f = { ...flags(), doneDay: dayKey(now) };
    setFlags(f);
    writeJson('hr:flags', f);
    setGoalReached(true);
  }
}

/** A person who reads for a while without touching the screen has stopped reading. */
const IDLE_MS = 45_000;

/** Count a second of reading for every second the page is visible and the learner has done something lately. */
export function startReadingClock(): () => void {
  let last = Date.now();
  const touch = () => {
    last = Date.now();
  };
  const events = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'click'] as const;
  for (const e of events) window.addEventListener(e, touch, { passive: true, capture: true });
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - last < IDLE_MS) addReading(1);
  }, 1000);
  return () => {
    window.clearInterval(timer);
    for (const e of events) window.removeEventListener(e, touch, { capture: true });
  };
}

/** A visitor who has never read anything here, and has not been through the first visit. */
export const isFirstVisit = (hasProgress: boolean) => !flags().started && !hasProgress;
