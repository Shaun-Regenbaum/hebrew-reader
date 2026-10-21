import { get, set } from 'idb-keyval';
import { createMemo, createSignal, untrack } from 'solid-js';
import type { ProgressMap } from './path.ts';
import { readJson, writeJson } from './prefs.ts';
import { normalizeWord } from './sentence.ts';
import type { SavedLookup, TextKind } from './types.ts';

/** Everything the learner has looked up, newest first. Kept in IndexedDB. */
const [lookups, setLookups] = createSignal<SavedLookup[]>([]);
const [known, setKnown] = createSignal<string[]>([]);

export { known, lookups };

/** Words (by surface form, no nikud) the learner has already looked up: the reader underlines them. */
export const seenWords = createMemo(() => new Set(lookups().map((l) => normalizeWord(l.word))));

/** What the learner has already met, for the quiet hints above words: by exact spot, and by spelling. */
export const hintMeanings = createMemo(() => {
  const byId = new Map<string, string>();
  const byWord = new Map<string, string>();
  for (const l of lookups()) {
    // lookups are newest first, so the first one we see for a spelling is the latest
    if (!byId.has(l.id)) byId.set(l.id, l.meaning);
    const w = normalizeWord(l.word);
    if (!byWord.has(w)) byWord.set(w, l.meaning);
  }
  return { byId, byWord };
});

/** The first short phrase of a meaning: "fifth / Thursday" becomes "fifth". */
export function shortMeaning(m: string): string {
  return (m.split(/[;,/(]/)[0] ?? m).trim();
}

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
const [progress, setProgress] = createSignal<ProgressMap>(readJson<ProgressMap>('hr:progress', {}));

export { progress };

function saveProgress(next: ProgressMap): void {
  setProgress(next);
  writeJson('hr:progress', next);
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
