import { describe, expect, it } from 'vitest';
import { normalizeWord, sentenceAt } from '../src/lib/sentence.ts';

const P = '– מה היה לך יעקב? – שאלו חבריו – איזה יום אתה חסר, השני או החמישי? והמתיאש הורה באצבע.';

describe('sentenceAt', () => {
  it('finds the sentence around a word', () => {
    const i = P.indexOf('החמישי');
    const s = sentenceAt(P, i);
    expect(s.text).toBe('– שאלו חבריו – איזה יום אתה חסר, השני או החמישי?');
    expect(P.slice(s.start, s.end)).toBe(s.text);
  });
  it('works for the first and last sentence', () => {
    expect(sentenceAt(P, 3).text).toBe('– מה היה לך יעקב?');
    expect(sentenceAt(P, P.indexOf('באצבע')).text).toBe('והמתיאש הורה באצבע.');
  });
  it('returns the whole text when there is no punctuation', () => {
    expect(sentenceAt('שלום עולם', 2).text).toBe('שלום עולם');
  });
});

describe('normalizeWord', () => {
  it('drops nikud', () => {
    expect(normalizeWord('שׁוֹקוֹלָד')).toBe('שוקולד');
  });
});
