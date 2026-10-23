import { type Card, createEmptyCard, fsrs, type Grade, generatorParameters, Rating, State } from 'ts-fsrs';
import type { SavedLookup } from './types.ts';

/**
 * Flashcards. One card per dictionary form. When to show a card again is worked out by FSRS (ts-fsrs), which
 * looks at how well each past answer went. A card is kept in a compact form so it can sync with the rest of the
 * learner's data.
 */

export interface StoredCard {
  /** When the card is next due (ms). */
  d: number;
  /** FSRS memory strength and difficulty. */
  s: number;
  df: number;
  /** FSRS state: 0 new, 1 learning, 2 review, 3 relearning. */
  st: number;
  /** Times reviewed, and times forgotten. */
  r: number;
  l: number;
  /** Days between the last two reviews, as scheduled. */
  sd: number;
  /** Position in the short learning steps. */
  ls: number;
  /** When it was last reviewed (ms), and first reviewed. */
  lr: number;
  fr: number;
}
export type CardMap = Record<string, StoredCard>;

export const NEW_PER_DAY = 10;
export const SESSION_MAX = 30;
/** A card that comes due within this long is shown again in the same sitting. */
export const SAME_SITTING_MS = 20 * 60_000;

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

const toCard = (c: StoredCard): Card => ({
  due: new Date(c.d),
  stability: c.s,
  difficulty: c.df,
  elapsed_days: 0,
  scheduled_days: c.sd,
  reps: c.r,
  lapses: c.l,
  learning_steps: c.ls,
  state: c.st as State,
  last_review: c.lr ? new Date(c.lr) : undefined,
});

const fromCard = (c: Card, first: number): StoredCard => ({
  d: c.due.getTime(),
  s: c.stability,
  df: c.difficulty,
  st: c.state,
  r: c.reps,
  l: c.lapses,
  sd: c.scheduled_days,
  ls: c.learning_steps,
  lr: c.last_review ? c.last_review.getTime() : 0,
  fr: first,
});

const current = (c: StoredCard | undefined, now: Date): Card => (c ? toCard(c) : createEmptyCard(now));

export type Answer = 'again' | 'hard' | 'good' | 'easy';
export const ANSWERS: Answer[] = ['again', 'hard', 'good', 'easy'];
const RATING: Record<Answer, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/** The card after the learner answered. */
export function answer(c: StoredCard | undefined, how: Answer, now = new Date()): StoredCard {
  const next = scheduler.next(current(c, now), now, RATING[how]).card;
  return fromCard(next, c?.fr || now.getTime());
}

/** How long until the card comes back, for each answer: "1 min", "10 min", "3 days". */
export function previews(c: StoredCard | undefined, now = new Date()): Record<Answer, string> {
  const log = scheduler.repeat(current(c, now), now);
  const out = {} as Record<Answer, string>;
  for (const how of ANSWERS) out[how] = wait(log[RATING[how]].card.due.getTime() - now.getTime());
  return out;
}

export function wait(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? '1 day' : `${days} days`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months} mo` : `${Math.round(months / 12)} y`;
}

export interface ReviewItem {
  lemma: string;
  /** The lookup we show: the sentence the learner met the word in, and its meaning. */
  lookup: SavedLookup;
  card: StoredCard | undefined;
}

export interface Queue {
  due: ReviewItem[];
  fresh: ReviewItem[];
  /** All of them in the order we ask, capped for one sitting. */
  items: ReviewItem[];
  /** New cards still allowed today, and how many words are waiting beyond that. */
  newLeft: number;
  waiting: number;
}

/** The start of the day the learner is in (local time). */
export const startOfDay = (now: Date) => new Date(now).setHours(0, 0, 0, 0);

/**
 * What to review now. Cards that are due come first, oldest first. Then new words from the newest lookups, no
 * more than NEW_PER_DAY a day. Words marked known are left out.
 * `lookups` is newest first.
 */
export function buildQueue(lookups: SavedLookup[], known: string[], cards: CardMap, now = new Date()): Queue {
  const skip = new Set(known);
  const latest = new Map<string, SavedLookup>();
  for (const l of lookups) if (!skip.has(l.lemma) && !latest.has(l.lemma)) latest.set(l.lemma, l);

  const due: ReviewItem[] = [];
  const fresh: ReviewItem[] = [];
  for (const [lemma, lookup] of latest) {
    const card = cards[lemma];
    if (!card) fresh.push({ lemma, lookup, card });
    else if (card.d <= now.getTime()) due.push({ lemma, lookup, card });
  }
  due.sort((a, b) => (a.card?.d ?? 0) - (b.card?.d ?? 0));

  const today = startOfDay(now);
  const startedToday = Object.values(cards).filter((c) => c.fr >= today).length;
  const newLeft = Math.max(0, NEW_PER_DAY - startedToday);
  const allowed = fresh.slice(0, newLeft);
  return {
    due,
    fresh: allowed,
    items: [...due, ...allowed].slice(0, SESSION_MAX),
    newLeft,
    waiting: fresh.length - allowed.length,
  };
}

/** When the next card will be due, if none is now. */
export function nextDue(cards: CardMap, known: string[]): number | null {
  const skip = new Set(known);
  const times = Object.entries(cards)
    .filter(([lemma]) => !skip.has(lemma))
    .map(([, c]) => c.d);
  return times.length ? Math.min(...times) : null;
}

/** Whether a card has been learned well enough to count as "learned": it came back after a day or more. */
export const isLearned = (c: StoredCard) => c.st === State.Review && c.sd >= 1;
