import { describe, expect, it } from 'vitest';
import { isDone, longReads, nextUp, type ProgressMap, pathItems, stages } from '../src/lib/path.ts';
import type { LibraryIndex, TextSummary } from '../src/lib/types.ts';

const t = (id: string, level: number, minutes: number, extra: Partial<TextSummary> = {}): TextSummary => ({
  id,
  kind: 'books',
  title: id,
  author: null,
  words: minutes * 60,
  sections: 1,
  level,
  uncommon: 40 + level * 3,
  style: 'literary',
  minutes,
  topics: [],
  blurb: '',
  ...extra,
});
const index: LibraryIndex = {
  books: [t('b3', 3, 5), t('b1', 1, 9), t('b1s', 1, 4), t('novel', 2, 300, { sections: 20 })],
  articles: [t('a2', 2, 6, { kind: 'articles' })],
  topics: [],
};

describe('path', () => {
  it('orders by level, then shorter first, and keeps novels out', () => {
    expect(pathItems(index).map((x) => x.id)).toEqual(['b1s', 'b1', 'a2', 'b3']);
    expect(longReads(index).map((x) => x.id)).toEqual(['novel']);
  });
  it('groups stages with their done counts and uncommon range', () => {
    const pm: ProgressMap = { 'books/b1s': { read: [0], last: 0, at: 1 } };
    const s = stages(pathItems(index), pm);
    expect(s.map((x) => [x.level, x.items.length, x.done])).toEqual([
      [1, 2, 1],
      [2, 1, 0],
      [3, 1, 0],
    ]);
    expect(s[0]?.uncommon).toEqual([43, 43]);
  });
});

describe('nextUp', () => {
  it('starts at the first step when nothing is read', () => {
    expect(nextUp(index, {})).toMatchObject({ mode: 'start', text: { id: 'b1s' } });
  });
  it('continues the text you were last in, even a long read', () => {
    const pm: ProgressMap = {
      'books/b1s': { read: [0], last: 0, at: 5 },
      'books/novel': { read: [0, 1], last: 1, at: 9 },
    };
    expect(nextUp(index, pm)).toMatchObject({ mode: 'continue', text: { id: 'novel' } });
  });
  it('moves to the next unfinished step once one is done', () => {
    const pm: ProgressMap = { 'books/b1s': { read: [0], last: 0, at: 5 } };
    expect(isDone(index.books[2] as TextSummary, pm)).toBe(true);
    expect(nextUp(index, pm)).toMatchObject({ mode: 'start', text: { id: 'b1' } });
  });
  it('falls back to long reads, then to nothing', () => {
    const done = (id: string, kind: string, sections = 1): [string, ProgressMap[string]] => [
      `${kind}/${id}`,
      { read: Array.from({ length: sections }, (_, i) => i), last: 0, at: 1 },
    ];
    const pm: ProgressMap = Object.fromEntries([
      done('b1s', 'books'),
      done('b1', 'books'),
      done('a2', 'articles'),
      done('b3', 'books'),
    ]);
    expect(nextUp(index, pm)).toMatchObject({ mode: 'long', text: { id: 'novel' } });
    expect(nextUp(index, { ...pm, ...Object.fromEntries([done('novel', 'books', 20)]) })).toBeNull();
  });
});
