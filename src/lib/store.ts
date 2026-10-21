import { get, set } from 'idb-keyval';
import { createMemo, createSignal, untrack } from 'solid-js';
import type { ProgressMap } from './path.ts';
import { readJson, writeJson } from './prefs.ts';
import { normalizeWord } from './sentence.ts';
import type { KnownEntry, SyncDoc } from './sync.ts';
import type { SavedLookup, TextKind } from './types.ts';

/**
 * Everything the learner keeps, on this device: lookups and known words in IndexedDB, reading progress in
 * localStorage (it is small, and the home screen needs it at once). `snapshot` and `applyDoc` move all of it
 * in and out as one document, for sync and backups.
 */

/** Everything the learner has looked up, newest first. */
const [lookups, setLookups] = createSignal<SavedLookup[]>([]);
/** Each known-word mark carries a time, so the newest choice wins when devices are combined. */
const [knownMap, setKnownMap] = createSignal<Record<string, KnownEntry>>({});
const [progress, setProgress] = createSignal<ProgressMap>(readJson<ProgressMap>('hr:progress', {}));

export { lookups, progress };

/** Dictionary forms the learner marked as known. */
export const known = createMemo(() =>
  Object.entries(knownMap())
    .filter(([, e]) => e.on)
    .map(([lemma]) => lemma),
);

/** Goes up whenever the learner changes something. Sync watches it; applying a synced copy does not move it. */
const [localVersion, setLocalVersion] = createSignal(0);

export { localVersion };

const changed = () => setLocalVersion((v) => v + 1);

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
  const stored = await read<unknown>('known', {});
  // An older version kept a plain list of words.
  setKnownMap(
    Array.isArray(stored)
      ? Object.fromEntries((stored as string[]).map((lemma) => [lemma, { on: true, at: 0 }]))
      : (stored as Record<string, KnownEntry>),
  );
  // Ask the browser not to clear our data when space is low.
  navigator.storage?.persist?.().catch(() => {});
}

export function saveLookup(l: SavedLookup): void {
  if (lookups().some((x) => x.id === l.id)) return;
  const next = [l, ...lookups()];
  setLookups(next);
  void write('lookups', next);
  changed();
}

export function toggleKnown(lemma: string): void {
  const next = { ...knownMap(), [lemma]: { on: !knownMap()[lemma]?.on, at: Date.now() } };
  setKnownMap(next);
  void write('known', next);
  changed();
}

function saveProgress(next: ProgressMap): void {
  setProgress(next);
  writeJson('hr:progress', next);
  changed();
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

/** All of the learner's data as one document. */
export function snapshot(): SyncDoc {
  return { v: 1, lookups: lookups(), known: knownMap(), progress: progress() };
}

/** Replace what is on this device with a merged copy. This is not a change the learner made, so it does not trigger a sync. */
export function applyDoc(doc: SyncDoc): void {
  setLookups(doc.lookups);
  setKnownMap(doc.known);
  setProgress(doc.progress);
  void write('lookups', doc.lookups);
  void write('known', doc.known);
  writeJson('hr:progress', doc.progress);
}

/** Make a change the learner caused (such as loading a backup) count, so it syncs. */
export const markChanged = changed;
