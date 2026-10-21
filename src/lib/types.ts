export type TextKind = 'books' | 'articles';

/** One row of public/texts/index.json. */
export type Style = 'modern' | 'literary' | 'biblical';

export interface TextSummary {
  id: string;
  kind: TextKind;
  title: string;
  author: string | null;
  words: number;
  sections: number;
  /** 1 (easiest in this library) to 5 (hardest). Measured, see scripts/measure.py. */
  level: number;
  /** Percent of words outside the 2,000 most common word forms. */
  uncommon: number;
  style: Style;
  /** Reading time for a learner, in minutes. */
  minutes: number;
  topics: string[];
  blurb: string;
}

export interface Topic {
  key: string;
  label: string;
}

export interface LibraryIndex {
  books: TextSummary[];
  articles: TextSummary[];
  topics: Topic[];
}

export interface TextMeta extends TextSummary {
  translator: string | null;
  credit: { name: string; url: string; license: string };
  sourceUrl: string;
}

/** A paragraph: its text, and the [start, end) offset of every word in it. */
export interface Para {
  t: string;
  w: [number, number][];
  h?: 1;
}

export interface Lookup {
  lemma: string;
  meaning: string;
  root: string | null;
  pos: string;
  binyan: string | null;
  say: string;
  note: string | null;
}

export interface SavedLookup extends Lookup {
  id: string;
  word: string;
  sentence: string;
  textId: string;
  textKind: TextKind;
  textTitle: string;
  at: number;
}
