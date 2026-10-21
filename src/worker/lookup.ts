import type { Lookup } from '../lib/types.ts';

export const LOOKUP_SYSTEM = [
  'You help a learner read Hebrew. Given a word as it appears in a sentence, reply with ONLY a JSON object, no other text, with these keys:',
  '"lemma": the dictionary form, in Hebrew, no nikud.',
  '"meaning": the English for this word as it works in this exact sentence, in the form it takes here (for example "asked", not "ask"; "his friends", not "friend"). Use the surrounding passage to choose the right sense.',
  '"root": the 3 or 4 letter shoresh in Hebrew, or null if it has none.',
  '"pos": one of noun, verb, adjective, adverb, preposition, conjunction, particle, name.',
  '"binyan": for verbs only, one of qal, nifal, piel, pual, hifil, hufal, hitpael. Otherwise null.',
  '"say": how to pronounce it in English letters, with the stressed syllable in capitals.',
  '"note": one short sentence about an attached prefix or an unusual form, or null.',
  'Separate attached prefixes (ו, ה, ב, ל, מ, ש, כ) from the word when you give the lemma and the meaning.',
].join('\n');

export const TRANSLATE_SYSTEM = [
  'You translate Hebrew for a learner. You get the passage a sentence comes from, the sentence, and its words numbered in order.',
  'Translate ONLY the sentence into natural, fluent English. Use the passage to choose the right sense of each word.',
  'Then give a short English gloss for each numbered word: what it means in this sentence, in the form it takes here (tense, number, pronoun endings). For example "שאלו" is "asked" and "חבריו" is "his friends".',
  'A gloss is one to three words. If a word has no separate English word here (a small particle, or a word absorbed into its neighbor), use an empty string.',
  'Reply with ONLY a JSON object: {"translation": "...", "glosses": ["...", "..."]} with exactly one gloss per numbered word, in order.',
].join('\n');

export interface Translation {
  translation: string;
  /** One English gloss per word of the sentence, or null when the model's list did not line up. */
  glosses: string[] | null;
}

/** Read the model's translation reply. Words that are not lined up one-to-one lose their glosses, not the translation. */
export function parseTranslation(raw: string, words: number): Translation | null {
  const t = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  if (!t) return null;
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0) return { translation: t.replace(/^["“]|["”]$/g, '').trim(), glosses: null };
  if (b < a) return null;
  try {
    const o = JSON.parse(t.slice(a, b + 1)) as Record<string, unknown>;
    const translation = str(o.translation);
    if (!translation) return null;
    const g = o.glosses;
    const ok = Array.isArray(g) && g.length === words && g.every((x) => typeof x === 'string');
    return { translation, glosses: ok ? (g as string[]).map((x) => x.trim()) : null };
  } catch {
    return null;
  }
}

const BINYAN: Record<string, string> = {
  qal: 'qal', paal: 'qal', "pa'al": 'qal', קל: 'qal', פעל: 'qal',
  nifal: 'nifal', "nif'al": 'nifal', נפעל: 'nifal',
  piel: 'piel', "pi'el": 'piel', פיעל: 'piel',
  pual: 'pual', "pu'al": 'pual', פועל: 'pual',
  hifil: 'hifil', "hif'il": 'hifil', הפעיל: 'hifil',
  hufal: 'hufal', "huf'al": 'hufal', הופעל: 'hufal',
  hitpael: 'hitpael', "hitpa'el": 'hitpael', התפעל: 'hitpael',
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Pull the first JSON object out of a model reply and check it has what we need. */
export function parseLookup(raw: string): Lookup | null {
  const t = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(t.slice(a, b + 1));
  } catch {
    return null;
  }
  const lemma = str(o.lemma);
  const meaning = str(o.meaning);
  if (!lemma || !meaning) return null;
  const pos = str(o.pos)?.toLowerCase() ?? 'word';
  const rawBinyan = str(o.binyan)?.toLowerCase() ?? null;
  return {
    lemma,
    meaning,
    root: str(o.root),
    pos,
    binyan: pos === 'verb' && rawBinyan ? (BINYAN[rawBinyan] ?? rawBinyan) : null,
    say: str(o.say) ?? '',
    note: str(o.note),
  };
}
