import { describe, expect, it } from 'vitest';
import { addSeconds, type DayMap, dayKey, minutesRead, prune, streak, week } from '../src/lib/daily.ts';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
const met = (...keys: string[]): DayMap => Object.fromEntries(keys.map((k) => [k, { s: 300, m: true }]));

describe('dayKey', () => {
  it('uses the local calendar day, padded', () => {
    expect(dayKey(day(2026, 3, 5))).toBe('2026-03-05');
  });
});

describe('streak', () => {
  const today = day(2026, 10, 23);
  it('is zero with nothing read', () => {
    expect(streak({}, today)).toBe(0);
  });
  it('counts today once its goal is met', () => {
    expect(streak(met('2026-10-23'), today)).toBe(1);
  });
  it('keeps running through yesterday while today is not met yet', () => {
    expect(streak(met('2026-10-22', '2026-10-21'), today)).toBe(2);
  });
  it('stops at a gap', () => {
    expect(streak(met('2026-10-23', '2026-10-22', '2026-10-20'), today)).toBe(2);
  });
  it('does not count a day that was read but short of the goal', () => {
    expect(streak({ '2026-10-23': { s: 60, m: false }, '2026-10-22': { s: 300, m: true } }, today)).toBe(1);
  });
  it('works across a month end', () => {
    expect(streak(met('2026-11-01', '2026-10-31', '2026-10-30'), day(2026, 11, 1))).toBe(3);
  });
});

describe('week', () => {
  it('starts on Sunday and marks today, met days and days to come', () => {
    const w = week(met('2026-10-21'), day(2026, 10, 23)); // a Friday
    expect(w.map((d) => d.letter).join('')).toBe('אבגדהוש');
    expect(w[0]?.key).toBe('2026-10-18');
    expect(w[3]?.met).toBe(true);
    expect(w[5]?.today).toBe(true);
    expect(w[6]?.future).toBe(true);
    expect(w[4]?.future).toBe(false);
  });
});

describe('addSeconds', () => {
  const today = day(2026, 10, 23);
  it('adds time and reports the moment the goal is reached, once', () => {
    let days: DayMap = {};
    let reached = false;
    for (let i = 0; i < 120; i++) {
      const r = addSeconds(days, today, 1, 2);
      days = r.days;
      if (r.reached) {
        expect(reached).toBe(false);
        reached = true;
        expect(days['2026-10-23']?.s).toBe(120);
      }
    }
    expect(reached).toBe(true);
    expect(days['2026-10-23']?.m).toBe(true);
    expect(addSeconds(days, today, 1, 2).reached).toBe(false);
  });
  it('never reaches a goal that was not set', () => {
    const r = addSeconds({}, today, 99999, null);
    expect(r.reached).toBe(false);
    expect(r.days['2026-10-23']?.m).toBe(false);
  });
  it('shows whole minutes', () => {
    expect(minutesRead(119)).toBe(1);
    expect(minutesRead(120)).toBe(2);
  });
});

describe('prune', () => {
  it('drops days older than the limit', () => {
    const out = prune(met('2026-10-23', '2026-01-01'), day(2026, 10, 23), 70);
    expect(Object.keys(out)).toEqual(['2026-10-23']);
  });
});
