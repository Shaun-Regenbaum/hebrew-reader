export type TextKind = 'books' | 'articles';

/** One row of public/texts/index.json. */
export interface TextSummary {
  id: string;
  kind: TextKind;
  title: string;
  author: string | null;
  words: number;
  sections: number;
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
