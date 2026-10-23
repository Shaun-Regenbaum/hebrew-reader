import { describe, expect, it } from 'vitest';
import {
  answer,
  buildQueue,
  type CardMap,
  NEW_PER_DAY,
  nextDue,
  previews,
  SESSION_MAX,
  type StoredCard,
  wait,
} from '../src/lib/review.ts';
import type { SavedLookup } from '../src/lib/types.ts';

const now = new Date(2026, 9, 23, 10, 0, 0);
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const look = (lemma: string, at: number): SavedLookup => ({
  id: `${lemma}:${at}`,
  word: lemma,
  sentence: `sentence ${lemma}`,
  lemma,
  meaning: `meaning of ${lemma}`,
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
const card = (over: Partial<StoredCard>): StoredCard => ({
  d: now.getTime() + DAY,
  s: 3,
  df: 5,
  st: 2,
  r: 2,
  l: 0,
  sd: 3,
  ls: 0,
  lr: now.getTime() - DAY,
  fr: now.getTime() - 5 * DAY,
  ...over,
});

describe('answer', () => {
  it('starts a new card and brings it back soon after "again"', () => {
    const c = answer(undefined, 'again', now);
    expect(c.r).toBe(1);
    expect(c.d - now.getTime()).toBeLessThan(15 * MIN);
    expect(c.fr).toBe(now.getTime());
  });
  it('sends a card far into the future after "easy"', () => {
    const c = answer(undefined, 'easy', now);
    expect(c.d - now.getTime()).toBeGreaterThan(2 * DAY);
  });
  it('remembers when the word was first reviewed', () => {
    const first = answer(undefined, 'good', now);
    const later = answer(first, 'good', new Date(now.getTime() + 2 * DAY));
    expect(later.fr).toBe(first.fr);
    expect(later.r).toBe(2);
  });
  it('waits longer for a better answer', () => {
    const p = answer(undefined, 'good', now);
    const q = previews(p, new Date(p.d));
    expect(q.again).not.toBe(q.easy);
  });
});

describe('wait', () => {
  it('says minutes, hours, days and months', () => {
    expect(wait(30_000)).toBe('1 min');
    expect(wait(10 * MIN)).toBe('10 min');
    expect(wait(3 * 60 * MIN)).toBe('3 h');
    expect(wait(DAY)).toBe('1 day');
    expect(wait(4 * DAY)).toBe('4 days');
    expect(wait(65 * DAY)).toBe('2 mo');
  });
});

describe('buildQueue', () => {
  const lookups = ['a', 'b', 'c', 'd'].map((l, i) => look(l, 100 - i)); // newest first
  it('offers new words from the newest lookups', () => {
    const q = buildQueue(lookups, [], {}, now);
    expect(q.items.map((i) => i.lemma)).toEqual(['a', 'b', 'c', 'd']);
    expect(q.due).toHaveLength(0);
  });
  it('puts due cards first, oldest first, and leaves out cards not yet due', () => {
    const cards: CardMap = {
      a: card({ d: now.getTime() - 2 * DAY }),
      b: card({ d: now.getTime() - 5 * DAY }),
      c: card({ d: now.getTime() + 3 * DAY }),
    };
    const q = buildQueue(lookups, [], cards, now);
    expect(q.items.map((i) => i.lemma)).toEqual(['b', 'a', 'd']);
  });
  it('leaves out words marked known', () => {
    expect(buildQueue(lookups, ['a', 'b'], {}, now).items.map((i) => i.lemma)).toEqual(['c', 'd']);
  });
  it('uses the newest lookup of a word', () => {
    const many = [look('a', 200), look('a', 100)];
    expect(buildQueue(many, [], {}, now).items[0]?.lookup.at).toBe(200);
  });
  it('allows only so many new words a day, counting those already started today', () => {
    const many = Array.from({ length: 25 }, (_, i) => look(`w${i}`, 1000 - i));
    expect(buildQueue(many, [], {}, now).fresh).toHaveLength(NEW_PER_DAY);
    const started: CardMap = {
      w0: card({ fr: now.getTime() - MIN, d: now.getTime() + DAY }),
      w1: card({ fr: now.getTime() - MIN, d: now.getTime() + DAY }),
    };
    const q = buildQueue(many, [], started, now);
    expect(q.fresh).toHaveLength(NEW_PER_DAY - 2);
    expect(q.waiting).toBe(25 - 2 - (NEW_PER_DAY - 2));
  });
  it('caps one sitting', () => {
    const cards: CardMap = {};
    const many = Array.from({ length: 80 }, (_, i) => {
      cards[`w${i}`] = card({ d: now.getTime() - DAY });
      return look(`w${i}`, 1000 - i);
    });
    expect(buildQueue(many, [], cards, now).items).toHaveLength(SESSION_MAX);
  });
});

describe('nextDue', () => {
  it('is the earliest due time among cards not marked known', () => {
    const cards: CardMap = { a: card({ d: 500 }), b: card({ d: 300 }), c: card({ d: 100 }) };
    expect(nextDue(cards, ['c'])).toBe(300);
    expect(nextDue({}, [])).toBeNull();
  });
});
