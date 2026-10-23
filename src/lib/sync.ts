import type { DayMap } from './daily.ts';
import type { ProgressMap } from './path.ts';
import type { CardMap, StoredCard } from './review.ts';
import type { SavedLookup, TextKind } from './types.ts';

/** What a learner keeps: their lookups, the words they marked known, how far they have read, and their flashcards. */
export interface SyncDoc {
  v: 1;
  lookups: SavedLookup[];
  /** Per dictionary form, with a time, so unmarking a word on one device wins over an older "known" on another. */
  known: Record<string, KnownEntry>;
  progress: ProgressMap;
  /** One flashcard per dictionary form. */
  cards: CardMap;
  /** The daily goal, chosen topics and minutes read each day. */
  habit: HabitDoc;
}
/** Each choice carries the time it was made, so the newest choice wins when devices are combined. */
export interface HabitDoc {
  goal: number | null;
  goalAt: number;
  topics: string[] | null;
  topicsAt: number;
  days: DayMap;
}
export interface KnownEntry {
  on: boolean;
  at: number;
}

export const MAX_LOOKUPS = 20000;
const MAX_KNOWN = 50000;
const MAX_TEXTS = 5000;
const MAX_CARDS = 50000;
const MAX_DAYS = 70;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STR = 2000;

export const emptyHabit = (): HabitDoc => ({ goal: null, goalAt: 0, topics: null, topicsAt: 0, days: {} });
export const emptyDoc = (): SyncDoc => ({
  v: 1,
  lookups: [],
  known: {},
  progress: {},
  cards: {},
  habit: emptyHabit(),
});

/** The newer of two choices. At the same time, the larger one, so the answer does not depend on the order. */
function newer<T>(a: { v: T; at: number }, b: { v: T; at: number }): { v: T; at: number } {
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return JSON.stringify(a.v) >= JSON.stringify(b.v) ? a : b;
}

function mergeHabit(a: HabitDoc, b: HabitDoc): HabitDoc {
  const goal = newer({ v: a.goal, at: a.goalAt }, { v: b.goal, at: b.goalAt });
  const topics = newer({ v: a.topics, at: a.topicsAt }, { v: b.topics, at: b.topicsAt });
  const days: DayMap = { ...a.days };
  for (const [k, d] of Object.entries(b.days)) {
    const cur = days[k];
    days[k] = cur ? { s: Math.max(cur.s, d.s), m: cur.m || d.m } : d;
  }
  const keep = Object.keys(days).sort().slice(-MAX_DAYS);
  return {
    goal: goal.v,
    goalAt: goal.at,
    topics: topics.v,
    topicsAt: topics.at,
    days: Object.fromEntries(keep.map((k) => [k, days[k] as DayMap[string]])),
  };
}

/**
 * Combine two copies of a learner's data without losing either. Lookups are united by id, known words take the
 * newest mark per word, sections read are united per text, a card keeps the copy that was reviewed last, and
 * for each day the longer reading time wins.
 */
export function mergeDocs(a: SyncDoc, b: SyncDoc): SyncDoc {
  const byId = new Map<string, SavedLookup>();
  for (const l of [...a.lookups, ...b.lookups]) {
    const cur = byId.get(l.id);
    if (!cur || l.at > cur.at) byId.set(l.id, l);
  }
  const lookups = [...byId.values()].sort((x, y) => y.at - x.at).slice(0, MAX_LOOKUPS);

  const known: Record<string, KnownEntry> = { ...a.known };
  for (const [lemma, e] of Object.entries(b.known)) {
    const cur = known[lemma];
    if (!cur || e.at > cur.at) known[lemma] = e;
  }

  const progress: ProgressMap = { ...a.progress };
  for (const [key, p] of Object.entries(b.progress)) {
    const cur = progress[key];
    if (!cur) {
      progress[key] = p;
      continue;
    }
    const newer = p.at > cur.at ? p : cur;
    progress[key] = {
      read: [...new Set([...cur.read, ...p.read])].sort((x, y) => x - y),
      last: newer.last,
      at: newer.at,
    };
  }

  const cards: CardMap = { ...a.cards };
  for (const [lemma, c] of Object.entries(b.cards)) {
    const cur = cards[lemma];
    if (!cur || c.lr > cur.lr || (c.lr === cur.lr && c.r > cur.r)) cards[lemma] = c;
  }
  return { v: 1, lookups, known, progress, cards, habit: mergeHabit(a.habit, b.habit) };
}

const isStr = (v: unknown, max = MAX_STR): v is string => typeof v === 'string' && v.length <= max;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isKind = (v: unknown): v is TextKind => v === 'books' || v === 'articles';
const optStr = (v: unknown) => (isStr(v) ? v : null);

function parseLookup(x: unknown): SavedLookup | null {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  if (
    !isStr(o.id, 200) ||
    !isStr(o.word, 100) ||
    !isStr(o.sentence) ||
    !isStr(o.lemma, 100) ||
    !isStr(o.meaning)
  )
    return null;
  if (!isStr(o.textId, 100) || !isKind(o.textKind) || !isStr(o.textTitle, 300) || !isNum(o.at)) return null;
  return {
    id: o.id,
    word: o.word,
    sentence: o.sentence,
    lemma: o.lemma,
    meaning: o.meaning,
    root: optStr(o.root),
    pos: isStr(o.pos, 50) ? o.pos : 'word',
    binyan: optStr(o.binyan),
    say: isStr(o.say, 200) ? o.say : '',
    note: optStr(o.note),
    textId: o.textId,
    textKind: o.textKind,
    textTitle: o.textTitle,
    at: o.at,
  };
}

function parseCard(x: unknown): StoredCard | null {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  const nums = [o.d, o.s, o.df, o.st, o.r, o.l, o.sd, o.ls, o.lr, o.fr];
  if (!nums.every(isNum) || (o.st as number) < 0 || (o.st as number) > 3) return null;
  return {
    d: o.d as number,
    s: o.s as number,
    df: o.df as number,
    st: o.st as number,
    r: o.r as number,
    l: o.l as number,
    sd: o.sd as number,
    ls: o.ls as number,
    lr: o.lr as number,
    fr: o.fr as number,
  };
}

function parseHabit(x: unknown): HabitDoc {
  const out = emptyHabit();
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return out;
  if (isNum(o.goal) && o.goal >= 1 && o.goal <= 180) out.goal = o.goal;
  if (isNum(o.goalAt)) out.goalAt = o.goalAt;
  if (Array.isArray(o.topics) && o.topics.length <= 8 && o.topics.every((t) => isStr(t, 40))) {
    out.topics = o.topics as string[];
  }
  if (isNum(o.topicsAt)) out.topicsAt = o.topicsAt;
  if (o.days && typeof o.days === 'object') {
    for (const [k, v] of Object.entries(o.days as Record<string, unknown>).slice(0, MAX_DAYS * 2)) {
      const d = v as { s?: unknown; m?: unknown } | null;
      if (DAY_KEY.test(k) && d && isNum(d.s) && d.s >= 0 && d.s <= 86400 && typeof d.m === 'boolean') {
        out.days[k] = { s: d.s, m: d.m };
      }
    }
  }
  return out;
}

/** Check data that came from a file or the network, and keep only what is well formed. Returns null if it is not ours at all. */
export function parseDoc(raw: unknown): SyncDoc | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || o.v !== 1) return null;
  const doc = emptyDoc();
  if (Array.isArray(o.lookups)) {
    for (const x of o.lookups.slice(0, MAX_LOOKUPS)) {
      const l = parseLookup(x);
      if (l) doc.lookups.push(l);
    }
  }
  if (o.known && typeof o.known === 'object') {
    for (const [lemma, e] of Object.entries(o.known as Record<string, unknown>).slice(0, MAX_KNOWN)) {
      const k = e as { on?: unknown; at?: unknown } | null;
      if (lemma.length <= 100 && k && typeof k.on === 'boolean' && isNum(k.at))
        doc.known[lemma] = { on: k.on, at: k.at };
    }
  }
  if (o.progress && typeof o.progress === 'object') {
    for (const [key, v] of Object.entries(o.progress as Record<string, unknown>).slice(0, MAX_TEXTS)) {
      const p = v as { read?: unknown; last?: unknown; at?: unknown } | null;
      if (key.length > 120 || !p || !Array.isArray(p.read) || !isNum(p.last) || !isNum(p.at)) continue;
      const read = [
        ...new Set(p.read.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 10000)),
      ].sort((x, y) => x - y);
      doc.progress[key] = { read, last: p.last, at: p.at };
    }
  }
  if (o.cards && typeof o.cards === 'object') {
    for (const [lemma, v] of Object.entries(o.cards as Record<string, unknown>).slice(0, MAX_CARDS)) {
      const c = parseCard(v);
      if (lemma.length <= 100 && c) doc.cards[lemma] = c;
    }
  }
  doc.habit = parseHabit(o.habit);
  return doc;
}

/** True when two copies hold the same data, so there is nothing to save. */
export function sameDoc(a: SyncDoc, b: SyncDoc): boolean {
  return JSON.stringify(mergeDocs(a, emptyDoc())) === JSON.stringify(mergeDocs(b, emptyDoc()));
}
