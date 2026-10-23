import { describe, expect, it } from 'vitest';
import {
  isDone,
  learnerLevel,
  longReads,
  nextUp,
  type ProgressMap,
  pathItems,
  stages,
  upNextByTopics,
} from '../src/lib/path.ts';
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

describe('upNextByTopics', () => {
  const topical: LibraryIndex = {
    books: [
      t('s1', 1, 3, { topics: ['space'] }),
      t('s3', 3, 4, { topics: ['space', 'animals'] }),
      t('a1', 1, 5, { topics: ['animals'] }),
      t('f2', 2, 2, { topics: ['food'] }),
    ],
    articles: [],
    topics: [],
  };
  const read = (id: string, at: number): ProgressMap => ({ [`books/${id}`]: { read: [], last: 0, at } });

  it('starts at level 1 when nothing has been read', () => {
    expect(learnerLevel(topical, {})).toBe(1);
  });
  it('gives one text per topic, closest to the learner level', () => {
    const picks = upNextByTopics(topical, read('s3', 5), ['space', 'animals', 'food']);
    expect(picks.map((p) => p.text.id)).toEqual(['s3', 'a1', 'f2']);
  });
  it('does not repeat a text that fits two topics', () => {
    const picks = upNextByTopics(topical, {}, ['space', 'animals']);
    expect(new Set(picks.map((p) => p.text.id)).size).toBe(picks.length);
  });
  it('skips finished texts and the one already shown', () => {
    const done: ProgressMap = { 'books/s1': { read: [0], last: 0, at: 1 } };
    const picks = upNextByTopics(topical, done, ['space'], 'books/s3');
    expect(picks).toEqual([]);
  });
  it('leaves out topics that have nothing left', () => {
    expect(upNextByTopics(topical, {}, ['nothing', 'food']).map((p) => p.topic)).toEqual(['food']);
  });
});
