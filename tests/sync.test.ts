import { describe, expect, it } from 'vitest';
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
