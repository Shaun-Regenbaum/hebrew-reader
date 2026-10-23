/** Daily reading: which day it is, the streak, and the week row. Pure, so it can be tested. */

/** What the learner read on one day: seconds of reading, and whether the day's goal was met. */
export interface DayRecord {
  s: number;
  m: boolean;
}
export type DayMap = Record<string, DayRecord>;

export const GOAL_CHOICES = [2, 5, 10] as const;
/** Hebrew letters for Sunday to Saturday, as on a Hebrew calendar. */
export const WEEK_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

/** The local calendar day, as 2026-10-23. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export const minutesRead = (seconds: number) => Math.floor(seconds / 60);

/** Days in a row with the goal met. Today counts once it is met; until then the streak runs up to yesterday. */
export function streak(days: DayMap, today: Date): number {
  let d = today;
  if (!days[dayKey(d)]?.m) d = addDays(d, -1);
  let n = 0;
  while (days[dayKey(d)]?.m) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export interface WeekDay {
  letter: string;
  key: string;
  today: boolean;
  met: boolean;
  future: boolean;
}

/** This week, Sunday first. */
export function week(days: DayMap, today: Date): WeekDay[] {
  const start = addDays(today, -today.getDay());
  const now = dayKey(today);
  return WEEK_LETTERS.map((letter, i) => {
    const key = dayKey(addDays(start, i));
    return { letter, key, today: key === now, met: !!days[key]?.m, future: key > now };
  });
}

/** Add reading time to a day. Returns the new map, and whether this is the moment the goal was first met. */
export function addSeconds(
  days: DayMap,
  today: Date,
  seconds: number,
  goalMinutes: number | null,
): { days: DayMap; reached: boolean } {
  const key = dayKey(today);
  const was = days[key] ?? { s: 0, m: false };
  const s = was.s + seconds;
  const met = was.m || (goalMinutes !== null && s >= goalMinutes * 60);
  return { days: { ...days, [key]: { s, m: met } }, reached: met && !was.m };
}

/** Keep only the last few weeks, so the stored map stays small. */
export function prune(days: DayMap, today: Date, keep = 70): DayMap {
  const oldest = dayKey(addDays(today, -keep));
  return Object.fromEntries(Object.entries(days).filter(([k]) => k >= oldest));
}
