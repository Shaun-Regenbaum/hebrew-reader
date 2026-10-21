import { get, set } from 'idb-keyval';
import { createMemo, createSignal } from 'solid-js';
import { normalizeWord } from './sentence.ts';
import type { SavedLookup, TextKind } from './types.ts';

/** Everything the learner has looked up, newest first. Kept in IndexedDB. */
const [lookups, setLookups] = createSignal<SavedLookup[]>([]);
const [known, setKnown] = createSignal<string[]>([]);
export { known, lookups };

/** Words (by surface form, no nikud) the learner has already looked up: the reader underlines them. */
export const seenWords = createMemo(() => new Set(lookups().map((l) => normalizeWord(l.word))));

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    return (await get<T>(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await set(key, value);
  } catch {
    /* private window or blocked storage: the session still works, it just will not persist */
  }
}

export async function loadStore(): Promise<void> {
  setLookups(await read<SavedLookup[]>('lookups', []));
  setKnown(await read<string[]>('known', []));
  // Ask the browser not to clear our data when space is low.
  navigator.storage?.persist?.().catch(() => {});
}

export function saveLookup(l: SavedLookup): void {
  if (lookups().some((x) => x.id === l.id)) return;
  const next = [l, ...lookups()];
  setLookups(next);
  void write('lookups', next);
}

export function toggleKnown(lemma: string): void {
  const next = known().includes(lemma) ? known().filter((x) => x !== lemma) : [...known(), lemma];
  setKnown(next);
  void write('known', next);
}

export interface Position {
  kind: TextKind;
  id: string;
  section: number;
}

export function lastPosition(): Position | null {
  try {
    const v = JSON.parse(localStorage.getItem('hr:pos') ?? 'null') as Position | null;
    return v && typeof v.id === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function rememberPosition(p: Position): void {
  try {
    localStorage.setItem('hr:pos', JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
