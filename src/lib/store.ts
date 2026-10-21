import { get, set } from 'idb-keyval';
import { createMemo, createSignal, untrack } from 'solid-js';
import { normalizeWord } from './sentence.ts';
import type { ProgressMap } from './path.ts';
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

/** Reading progress per text, kept in localStorage (it is small, and the home screen needs it at once). */
function readProgress(): ProgressMap {
  try {
    const v = JSON.parse(localStorage.getItem('hr:progress') ?? '{}') as ProgressMap;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
const [progress, setProgress] = createSignal<ProgressMap>(readProgress());
export { progress };

function saveProgress(next: ProgressMap): void {
  setProgress(next);
  try {
    localStorage.setItem('hr:progress', JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** The learner is in this section: remember where, and when. */
export function touchText(kind: TextKind, id: string, section: number): void {
  const k = `${kind}/${id}`;
  // untrack: these run inside effects, and reading what they then write would loop forever
  const all = untrack(progress);
  saveProgress({ ...all, [k]: { read: all[k]?.read ?? [], last: section, at: Date.now() } });
}

/** The learner reached the end of this section. */
export function markSectionRead(kind: TextKind, id: string, section: number): void {
  const k = `${kind}/${id}`;
  const all = untrack(progress);
  if (all[k]?.read.includes(section)) return;
  saveProgress({ ...all, [k]: { read: [...(all[k]?.read ?? []), section], last: section, at: Date.now() } });
}
