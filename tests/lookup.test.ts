import { describe, expect, it } from 'vitest';
import { parseLookup, parseTranslation } from '../src/worker/lookup.ts';

describe('parseLookup', () => {
  it('reads a clean answer', () => {
    const r = parseLookup('{"lemma":"חמישי","meaning":"the fifth","root":"חמש","pos":"adjective","binyan":null,"say":"khamiSHI","note":null}');
    expect(r).toMatchObject({ lemma: 'חמישי', meaning: 'the fifth', root: 'חמש', pos: 'adjective', binyan: null });
  });
  it('strips a code fence and surrounding text', () => {
    const r = parseLookup('Here you go:\n```json\n{"lemma":"פקח","meaning":"opened","root":"פקח","pos":"verb","binyan":"pa\'al","say":"paKHA"}\n```');
    expect(r?.binyan).toBe('qal');
  });
  it('maps Hebrew and misspelled binyan names', () => {
    expect(parseLookup('{"lemma":"התגולל","meaning":"wallow","pos":"verb","binyan":"hitpa\'el"}')?.binyan).toBe('hitpael');
    expect(parseLookup('{"lemma":"שכח","meaning":"forgot","pos":"verb","binyan":"פעל"}')?.binyan).toBe('qal');
  });
  it('drops binyan on non-verbs', () => {
    expect(parseLookup('{"lemma":"עין","meaning":"eye","pos":"noun","binyan":"qal"}')?.binyan).toBeNull();
  });
  it('rejects answers with no lemma or meaning, and non-JSON', () => {
    expect(parseLookup('{"lemma":"עין"}')).toBeNull();
    expect(parseLookup('sorry, no')).toBeNull();
    expect(parseLookup('')).toBeNull();
  });
});

describe('parseTranslation', () => {
  it('reads a translation with one gloss per word', () => {
    const r = parseTranslation('{"translation":"his friends asked","glosses":["asked","his friends"]}', 2);
    expect(r).toEqual({ translation: 'his friends asked', glosses: ['asked', 'his friends'] });
  });
  it('keeps the translation but drops glosses that do not line up', () => {
    const r = parseTranslation('{"translation":"his friends asked","glosses":["asked"]}', 2);
    expect(r).toEqual({ translation: 'his friends asked', glosses: null });
  });
  it('accepts a plain-text reply with no glosses', () => {
    expect(parseTranslation('"His friends asked."', 2)).toEqual({ translation: 'His friends asked.', glosses: null });
  });
  it('allows empty glosses for particles', () => {
    expect(parseTranslation('{"translation":"x","glosses":["","book"]}', 2)?.glosses).toEqual(['', 'book']);
  });
  it('rejects empty and broken replies', () => {
    expect(parseTranslation('', 2)).toBeNull();
    expect(parseTranslation('{"glosses":[]}', 0)).toBeNull();
    expect(parseTranslation('{"translation":', 2)).toBeNull();
  });
});
