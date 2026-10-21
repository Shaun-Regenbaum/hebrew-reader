import type { Lookup } from '../lib/types.ts';

export const LOOKUP_SYSTEM = [
  'You help a learner read Hebrew. Given a word as it appears in a sentence, reply with ONLY a JSON object, no other text, with these keys:',
  '"lemma": the dictionary form, in Hebrew, no nikud.',
  '"meaning": a short English meaning of this word in this sentence.',
  '"root": the 3 or 4 letter shoresh in Hebrew, or null if it has none.',
  '"pos": one of noun, verb, adjective, adverb, preposition, conjunction, particle, name.',
  '"binyan": for verbs only, one of qal, nifal, piel, pual, hifil, hufal, hitpael. Otherwise null.',
  '"say": how to pronounce it in English letters, with the stressed syllable in capitals.',
  '"note": one short sentence about an attached prefix or an unusual form, or null.',
  'Separate attached prefixes (ו, ה, ב, ל, מ, ש, כ) from the word when you give the lemma and the meaning.',
].join('\n');

export const TRANSLATE_SYSTEM =
  'Translate the Hebrew into natural, fluent English. Keep the meaning and tone. Reply with ONLY the translation, no notes.';

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
