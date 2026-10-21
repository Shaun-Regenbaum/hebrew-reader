/**
 * Anonymous word counts: for each text, how many readers looked a word up for the first time.
 * No account and no device id is stored, only the word, the text and a count.
 */
import { Hono } from 'hono';
import type { AppEnv, Env } from './env.ts';

const TEXT_KEY = /^(books|articles)\/\d{1,12}$/;

export async function recordFirstLookup(env: Env, lemma: unknown, textKey: unknown): Promise<void> {
  if (typeof lemma !== 'string' || !lemma || lemma.length > 100) return;
  if (typeof textKey !== 'string' || !TEXT_KEY.test(textKey)) return;
  try {
    await env.DB.prepare(
      'INSERT INTO word_stats (lemma, text_key, n) VALUES (?, ?, 1) ON CONFLICT (lemma, text_key) DO UPDATE SET n = n + 1',
    )
      .bind(lemma, textKey)
      .run();
  } catch {
    /* counting must never break a lookup */
  }
}

export const stats = new Hono<AppEnv>();

/** The words readers look up most. ?text=books/665 for one text, otherwise across all of them. */
stats.get('/words', async (c) => {
  const text = c.req.query('text');
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
  const rows =
    text && TEXT_KEY.test(text)
      ? await c.env.DB.prepare('SELECT lemma, n FROM word_stats WHERE text_key = ? ORDER BY n DESC LIMIT ?')
          .bind(text, limit)
          .all()
      : await c.env.DB.prepare(
          'SELECT lemma, SUM(n) AS n FROM word_stats GROUP BY lemma ORDER BY n DESC LIMIT ?',
        )
          .bind(limit)
          .all();
  return c.json({ words: rows.results });
});
