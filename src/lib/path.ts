import type { LibraryIndex, TextSummary } from './types.ts';

/** Texts longer than this are "long reads": novels you take in sections, not steps on the path. */
export const LONG_READ_WORDS = 12000;
export const STAGE_NAMES = ['First steps', 'Easiest', 'Easy', 'Medium', 'Hard', 'Hardest'];
export const LEVEL_COUNT = STAGE_NAMES.length;

export interface Progress {
  /** Sections the learner has read to the end. */
  read: number[];
  /** The section they were last in. */
  last: number;
  /** When they last read it (ms). */
  at: number;
}
export type ProgressMap = Record<string, Progress>;

export const keyOf = (t: Pick<TextSummary, 'kind' | 'id'>) => `${t.kind}/${t.id}`;
export const allTexts = (i: LibraryIndex): TextSummary[] => [...i.books, ...i.articles];

export const isDone = (t: TextSummary, pm: ProgressMap) => (pm[keyOf(t)]?.read.length ?? 0) >= t.sections;
export const isStarted = (t: TextSummary, pm: ProgressMap) => !!pm[keyOf(t)];
export const sectionsRead = (t: TextSummary, pm: ProgressMap) =>
  Math.min(t.sections, pm[keyOf(t)]?.read.length ?? 0);

/** Texts in the order a learner should meet them: easier first, and within a level shorter first. */
export function pathItems(i: LibraryIndex): TextSummary[] {
  return allTexts(i)
    .filter((t) => t.words <= LONG_READ_WORDS)
    .sort((a, b) => a.level - b.level || a.minutes - b.minutes || a.title.localeCompare(b.title, 'he'));
}

export function longReads(i: LibraryIndex): TextSummary[] {
  return allTexts(i)
    .filter((t) => t.words > LONG_READ_WORDS)
    .sort((a, b) => a.level - b.level || a.words - b.words);
}

export interface Stage {
  level: number;
  name: string;
  items: TextSummary[];
  done: number;
  minutes: number;
  /** Range of "uncommon words per 100" across the stage's texts. */
  uncommon: [number, number];
}

export function stages(items: TextSummary[], pm: ProgressMap): Stage[] {
  const out: Stage[] = [];
  for (let level = 1; level <= LEVEL_COUNT; level++) {
    const its = items.filter((t) => t.level === level);
    if (!its.length) continue;
    const u = its.map((t) => t.uncommon);
    out.push({
      level,
      name: STAGE_NAMES[level - 1] as string,
      items: its,
      done: its.filter((t) => isDone(t, pm)).length,
      minutes: its.reduce((n, t) => n + t.minutes, 0),
      uncommon: [Math.min(...u), Math.max(...u)],
    });
  }
  return out;
}

export interface NextUp {
  text: TextSummary;
  /** continue: already started. start: the next text on the path. long: only long reads are left. */
  mode: 'continue' | 'start' | 'long';
}

/** What to read next: pick up the text you were last in, else the next unfinished step on the path. */
export function nextUp(i: LibraryIndex, pm: ProgressMap): NextUp | null {
  const items = pathItems(i);
  const longs = longReads(i);
  const everything = [...items, ...longs];
  const inProgress = everything
    .filter((t) => isStarted(t, pm) && !isDone(t, pm))
    .sort((a, b) => (pm[keyOf(b)]?.at ?? 0) - (pm[keyOf(a)]?.at ?? 0))[0];
  if (inProgress) return { text: inProgress, mode: 'continue' };
  const step = items.find((t) => !isDone(t, pm));
  if (step) return { text: step, mode: 'start' };
  const long = longs.find((t) => !isDone(t, pm));
  return long ? { text: long, mode: 'long' } : null;
}

/** The text a first-time visitor opens: short and gentle, and its first screen is answered ahead of time. */
export const FIRST_TEXT = { kind: 'books', id: '11483' } as const;

/** The level the learner is reading at now: that of the text they touched last. */
export function learnerLevel(i: LibraryIndex, pm: ProgressMap): number {
  const last = allTexts(i)
    .filter((t) => isStarted(t, pm))
    .sort((a, b) => (pm[keyOf(b)]?.at ?? 0) - (pm[keyOf(a)]?.at ?? 0))[0];
  return last ? last.level : 1;
}

/**
 * One unfinished text for each chosen topic, closest to the learner's level, shortest first.
 * `skip` is a text already shown elsewhere (the one to continue).
 */
export function upNextByTopics(
  i: LibraryIndex,
  pm: ProgressMap,
  topics: string[],
  skip?: string,
  max = 3,
): { topic: string; text: TextSummary }[] {
  const level = learnerLevel(i, pm);
  const pool = pathItems(i).filter((t) => !isDone(t, pm) && keyOf(t) !== skip);
  const taken = new Set<string>();
  const out: { topic: string; text: TextSummary }[] = [];
  for (const topic of topics) {
    const best = pool
      .filter((t) => t.topics.includes(topic) && !taken.has(keyOf(t)))
      .sort(
        (a, b) =>
          Math.abs(a.level - level) - Math.abs(b.level - level) || a.level - b.level || a.minutes - b.minutes,
      )[0];
    if (best) {
      taken.add(keyOf(best));
      out.push({ topic, text: best });
    }
    if (out.length >= max) break;
  }
  return out;
}
