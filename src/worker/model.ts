/**
 * The two routes that call the model through OpenRouter:
 *   POST /api/lookup     { word, sentence, context, title }  -> the word's meaning in this sentence
 *   POST /api/translate  { text, context, words, title }     -> a natural English translation, and a gloss per word
 * Answers are cached in KV, so a repeat tap costs nothing.
 */
import { Hono } from 'hono';
import type { Lookup } from '../lib/types.ts';
import type { AppEnv, Env } from './env.ts';
import {
  LOOKUP_SYSTEM,
  parseLookup,
  parseTranslation,
  TRANSLATE_SYSTEM,
  type Translation,
} from './lookup.ts';
import { recordFirstLookup } from './stats.ts';
import { clean, clientIp, sha256Hex, tooMany, withinDailyCap } from './util.ts';

const MAX_WORD = 40;
const MAX_TEXT = 1500;
const MAX_TITLE = 200;
const MAX_WORDS = 80;
const PER_MINUTE = 40;

async function askModel(env: Env, model: string, system: string, user: string): Promise<string> {
  // No max_tokens: models spend part of it thinking, and a cap cuts the answer off mid-sentence.
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'hebrew-reader',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      // Thinking is what made answers slow: default thinking took 6 to 10 s, low takes about 2 s.
      reasoning: { effort: 'low' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`model ${res.status}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content?.trim() ?? '';
}

const dailyCap = (env: Env) => withinDailyCap(env, 'model', Number(env.DAILY_MODEL_CALLS) || 6000);

export const model = new Hono<AppEnv>();

model.post('/lookup', async (c) => {
  if (tooMany(clientIp(c), PER_MINUTE)) return c.json({ error: 'Too many requests' }, 429);
  const body = await c.req.json().catch(() => null);
  const word = clean(body?.word, MAX_WORD);
  const sentence = clean(body?.sentence, MAX_TEXT);
  const title = clean(body?.title, MAX_TITLE) ?? '';
  const context = clean(body?.context, MAX_TEXT) ?? sentence;
  if (!word || !sentence) return c.json({ error: 'word and sentence are required' }, 400);

  // Count the word the first time this reader looks it up, whether or not the answer was cached.
  const count = (lookup: Lookup) => {
    if (body?.first === true) c.executionCtx.waitUntil(recordFirstLookup(c.env, lookup.lemma, body?.textKey));
  };

  const key = `lookup:v1:${c.env.LOOKUP_MODEL}:${await sha256Hex(`${word}|${sentence}`)}`;
  const hit = (await c.env.CACHE?.get(key, 'json')) as Lookup | null | undefined;
  if (hit) {
    count(hit);
    return c.json({ lookup: hit, cached: true });
  }

  if (!(await dailyCap(c.env))) {
    return c.json({ error: 'The daily limit for lookups is used up. Try again tomorrow.' }, 429);
  }
  try {
    const raw = await askModel(
      c.env,
      c.env.LOOKUP_MODEL,
      LOOKUP_SYSTEM,
      `Word: ${word}\nSentence: ${sentence}\nPassage: ${context}\nFrom: ${title}`,
    );
    const lookup = parseLookup(raw);
    if (!lookup) return c.json({ error: 'The model gave an answer we could not read' }, 502);
    await c.env.CACHE?.put(key, JSON.stringify(lookup));
    count(lookup);
    return c.json({ lookup, cached: false });
  } catch {
    return c.json({ error: 'Lookup failed. Try again.' }, 502);
  }
});

model.post('/translate', async (c) => {
  if (tooMany(clientIp(c), PER_MINUTE)) return c.json({ error: 'Too many requests' }, 429);
  const body = await c.req.json().catch(() => null);
  const text = clean(body?.text, MAX_TEXT);
  const context = clean(body?.context, MAX_TEXT) ?? text;
  const title = clean(body?.title, MAX_TITLE) ?? '';
  const words: string[] = Array.isArray(body?.words)
    ? body.words
        .filter((w: unknown): w is string => typeof w === 'string' && w.length <= MAX_WORD)
        .slice(0, MAX_WORDS)
    : [];
  if (!text) return c.json({ error: 'text is required' }, 400);

  const modelName = c.env.TRANSLATE_MODEL || c.env.LOOKUP_MODEL;
  const key = `translate:v2:${modelName}:${await sha256Hex(`${text}|${words.join(' ')}`)}`;
  const hit = await c.env.CACHE?.get(key, 'json');
  if (hit) return c.json({ ...(hit as Translation), cached: true });

  if (!(await dailyCap(c.env))) {
    return c.json({ error: 'The daily limit for translations is used up. Try again tomorrow.' }, 429);
  }
  try {
    const numbered = words.map((w, i) => `${i + 1}. ${w}`).join('\n');
    const raw = await askModel(
      c.env,
      modelName,
      TRANSLATE_SYSTEM,
      `From: ${title}\nPassage: ${context}\nSentence: ${text}\nWords:\n${numbered}`,
    );
    const out = parseTranslation(raw, words.length);
    if (!out) return c.json({ error: 'The model gave an answer we could not read' }, 502);
    await c.env.CACHE?.put(key, JSON.stringify(out));
    return c.json({ ...out, cached: false });
  } catch {
    return c.json({ error: 'Translation failed. Try again.' }, 502);
  }
});
