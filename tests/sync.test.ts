import { describe, expect, it } from 'vitest';
import type { StoredCard } from '../src/lib/review.ts';
import { emptyDoc, MAX_LOOKUPS, mergeDocs, parseDoc, type SyncDoc, sameDoc } from '../src/lib/sync.ts';
import type { SavedLookup } from '../src/lib/types.ts';

const look = (id: string, at: number, meaning = 'm'): SavedLookup => ({
  id,
  word: 'w',
  sentence: 's',
  lemma: 'l',
  meaning,
  root: null,
  pos: 'noun',
  binyan: null,
  say: '',
  note: null,
  textId: '1',
  textKind: 'books',
  textTitle: 't',
  at,
});
const card = (lr: number, r = 1): StoredCard => ({
  d: 1,
  s: 2,
  df: 3,
  st: 2,
  r,
  l: 0,
  sd: 1,
  ls: 0,
  lr,
  fr: 1,
});
const doc = (p: Partial<SyncDoc>): SyncDoc => ({ ...emptyDoc(), ...p });

describe('mergeDocs', () => {
  it('unites lookups by id, newest first, and keeps the newer copy of the same id', () => {
    const a = doc({ lookups: [look('a', 5, 'old'), look('b', 3)] });
    const b = doc({ lookups: [look('a', 9, 'new'), look('c', 7)] });
    const m = mergeDocs(a, b);
    expect(m.lookups.map((l) => l.id)).toEqual(['a', 'c', 'b']);
    expect(m.lookups[0]?.meaning).toBe('new');
  });
  it('lets the newest known mark win, so unmarking sticks', () => {
    const a = doc({ known: { x: { on: true, at: 1 }, y: { on: true, at: 5 } } });
    const b = doc({ known: { x: { on: false, at: 4 }, z: { on: true, at: 2 } } });
    expect(mergeDocs(a, b).known).toEqual({
      x: { on: false, at: 4 },
      y: { on: true, at: 5 },
      z: { on: true, at: 2 },
    });
  });
  it('unites sections read and keeps the newest position', () => {
    const a = doc({ progress: { 'books/1': { read: [0, 2], last: 2, at: 5 } } });
    const b = doc({
      progress: { 'books/1': { read: [1, 2], last: 1, at: 9 }, 'books/2': { read: [0], last: 0, at: 1 } },
    });
    const m = mergeDocs(a, b);
    expect(m.progress['books/1']).toEqual({ read: [0, 1, 2], last: 1, at: 9 });
    expect(m.progress['books/2']?.read).toEqual([0]);
  });
  it('is the same whichever order the copies are merged', () => {
    const a = doc({ lookups: [look('a', 1)], known: { x: { on: true, at: 3 } } });
    const b = doc({ lookups: [look('b', 2)], known: { x: { on: false, at: 8 } } });
    expect(mergeDocs(a, b)).toEqual(mergeDocs(b, a));
  });
  it('caps the number of lookups, keeping the newest', () => {
    const many = Array.from({ length: MAX_LOOKUPS + 5 }, (_, i) => look(`id${i}`, i));
    const m = mergeDocs(doc({ lookups: many }), emptyDoc());
    expect(m.lookups).toHaveLength(MAX_LOOKUPS);
    expect(m.lookups[0]?.id).toBe(`id${MAX_LOOKUPS + 4}`);
  });
});

describe('parseDoc', () => {
  it('accepts a good document and round-trips it', () => {
    const d = doc({
      lookups: [look('a', 1)],
      known: { x: { on: true, at: 2 } },
      progress: { 'books/1': { read: [0], last: 0, at: 3 } },
    });
    expect(parseDoc(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it('rejects things that are not ours', () => {
    expect(parseDoc(null)).toBeNull();
    expect(parseDoc('x')).toBeNull();
    expect(parseDoc({ v: 2 })).toBeNull();
    expect(parseDoc({ lookups: [] })).toBeNull();
  });
  it('drops malformed entries but keeps the good ones', () => {
    const raw = {
      v: 1,
      lookups: [look('a', 1), { id: 'bad' }, 7, null, { ...look('c', 2), textKind: 'movies' }],
      known: { ok: { on: true, at: 1 }, bad: { on: 'yes', at: 1 } },
      progress: { 'books/1': { read: [0, 0, 1, -3, 'x', 1.5], last: 1, at: 2 }, 'books/2': { read: 'nope' } },
    };
    const d = parseDoc(raw);
    expect(d?.lookups.map((l) => l.id)).toEqual(['a']);
    expect(Object.keys(d?.known ?? {})).toEqual(['ok']);
    expect(d?.progress['books/1']?.read).toEqual([0, 1]);
    expect(d?.progress['books/2']).toBeUndefined();
  });
});

describe('sameDoc', () => {
  it('ignores order and detects a real difference', () => {
    const a = doc({ lookups: [look('a', 1), look('b', 2)] });
    const b = doc({ lookups: [look('b', 2), look('a', 1)] });
    expect(sameDoc(a, b)).toBe(true);
    expect(sameDoc(a, doc({ lookups: [look('a', 1)] }))).toBe(false);
  });
});

describe('flashcards in a synced document', () => {
  it('keeps the copy of a card that was reviewed last', () => {
    const a = doc({ cards: { x: card(5), y: card(9) } });
    const b = doc({ cards: { x: card(8), z: card(1) } });
    const m = mergeDocs(a, b);
    expect(m.cards.x?.lr).toBe(8);
    expect(Object.keys(m.cards).sort()).toEqual(['x', 'y', 'z']);
    expect(mergeDocs(a, b)).toEqual(mergeDocs(b, a));
  });
  it('reads cards back from a saved document, and drops malformed ones', () => {
    const raw = {
      v: 1,
      cards: { good: card(3), bad: { d: 'soon' }, worse: { ...card(3), st: 9 } },
    };
    const parsed = parseDoc(raw);
    expect(Object.keys(parsed?.cards ?? {})).toEqual(['good']);
  });
  it('reads an older document that has no cards', () => {
    expect(parseDoc({ v: 1, lookups: [], known: {}, progress: {} })?.cards).toEqual({});
  });
  it('counts a card as a change', () => {
    expect(sameDoc(doc({ cards: { x: card(1) } }), emptyDoc())).toBe(false);
  });
});

describe('the daily habit in a synced document', () => {
  const habit = (p: Partial<SyncDoc['habit']>): SyncDoc['habit'] => ({ ...emptyDoc().habit, ...p });
  it('keeps the newest goal and the newest topics', () => {
    const a = doc({ habit: habit({ goal: 5, goalAt: 10, topics: ['x', 'y', 'z'], topicsAt: 1 }) });
    const b = doc({ habit: habit({ goal: 10, goalAt: 20, topics: ['p', 'q', 'r'], topicsAt: 0 }) });
    const m = mergeDocs(a, b).habit;
    expect(m.goal).toBe(10);
    expect(m.topics).toEqual(['x', 'y', 'z']);
  });
  it('does not lose a goal to a device that never chose one', () => {
    const a = doc({ habit: habit({ goal: 5, goalAt: 10 }) });
    expect(mergeDocs(a, emptyDoc()).habit.goal).toBe(5);
    expect(mergeDocs(emptyDoc(), a).habit.goal).toBe(5);
  });
  it('takes the longer reading time for each day, and keeps a met goal', () => {
    const a = doc({
      habit: habit({ days: { '2026-10-22': { s: 100, m: false }, '2026-10-23': { s: 400, m: true } } }),
    });
    const b = doc({
      habit: habit({ days: { '2026-10-22': { s: 320, m: true }, '2026-10-21': { s: 60, m: false } } }),
    });
    const m = mergeDocs(a, b).habit.days;
    expect(m['2026-10-22']).toEqual({ s: 320, m: true });
    expect(m['2026-10-23']).toEqual({ s: 400, m: true });
    expect(m['2026-10-21']).toEqual({ s: 60, m: false });
  });
  it('gives the same result in either order, even for a tie', () => {
    const a = doc({ habit: habit({ goal: 5, goalAt: 7, days: { '2026-10-23': { s: 1, m: false } } }) });
    const b = doc({ habit: habit({ goal: 10, goalAt: 7, days: { '2026-10-23': { s: 2, m: true } } }) });
    expect(mergeDocs(a, b)).toEqual(mergeDocs(b, a));
  });
  it('keeps only the last ten weeks of days', () => {
    const days: Record<string, { s: number; m: boolean }> = {};
    for (let i = 0; i < 100; i++)
      days[
        `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`
      ] = { s: 1, m: false };
    expect(Object.keys(mergeDocs(doc({ habit: habit({ days }) }), emptyDoc()).habit.days)).toHaveLength(70);
  });
  it('reads the habit back, and drops values that are out of range or malformed', () => {
    const parsed = parseDoc({
      v: 1,
      habit: {
        goal: 5,
        goalAt: 3,
        topics: ['a', 'b', 'c'],
        topicsAt: 4,
        days: {
          '2026-10-23': { s: 300, m: true },
          'bad-key': { s: 1, m: true },
          '2026-10-22': { s: -5, m: true },
        },
      },
    });
    expect(parsed?.habit.goal).toBe(5);
    expect(parsed?.habit.topics).toEqual(['a', 'b', 'c']);
    expect(Object.keys(parsed?.habit.days ?? {})).toEqual(['2026-10-23']);
    expect(parseDoc({ v: 1, habit: { goal: 9999, topics: [1, 2] } })?.habit).toEqual(emptyDoc().habit);
  });
  it('reads an older document that has no habit', () => {
    expect(parseDoc({ v: 1, lookups: [] })?.habit).toEqual(emptyDoc().habit);
  });
});
