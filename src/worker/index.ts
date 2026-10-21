/**
 * Hebrew reader Worker. Two routes call the model through OpenRouter:
 *   POST /api/lookup     { word, sentence, title }  -> the word's meaning in this sentence
 *   POST /api/translate  { text }                   -> a natural English translation
 * Everything else is served from the built client (the ASSETS binding).
 * Answers are cached in KV when a CACHE binding exists, so a repeat tap costs nothing.
 */
import { Hono } from 'hono';
import type { Lookup } from '../lib/types.ts';
import {
  LOOKUP_SYSTEM,
  parseLookup,
  parseTranslation,
  TRANSLATE_SYSTEM,
  type Translation,
} from './lookup.ts';

interface Env {
  ASSETS: Fetcher;
  OPENROUTER_API_KEY: string;
  LOOKUP_MODEL: string;
  /** Faster model for sentence translation. Falls back to LOOKUP_MODEL. */
  TRANSLATE_MODEL?: string;
  CACHE?: KVNamespace;
  /** Model calls allowed per day across all visitors. Cache hits do not count. Default 6000. */
  DAILY_MODEL_CALLS?: string;
}

const MAX_WORD = 40;
const MAX_TEXT = 1500;
const MAX_TITLE = 200;
const MAX_WORDS = 80;
const PER_MINUTE = 40;

const app = new Hono<{ Bindings: Env }>();

// A per-isolate limiter: it slows a runaway client, it does not stop a determined one.
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > PER_MINUTE;
}

/** Count one model call against today's cap. KV is not atomic, so this is a soft limit. */
async function withinDailyCap(env: Env): Promise<boolean> {
  if (!env.CACHE) return true;
  const cap = Number(env.DAILY_MODEL_CALLS) || 6000;
  const key = `cap:${new Date().toISOString().slice(0, 10)}`;
  const used = Number(await env.CACHE.get(key)) || 0;
  if (used >= cap) return false;
  await env.CACHE.put(key, String(used + 1), { expirationTtl: 172_800 });
  return true;
}

async function sha(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

const clean = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null;

app.post('/api/lookup', async (c) => {
  if (tooMany(c.req.header('cf-connecting-ip') ?? 'local'))
    return c.json({ error: 'Too many requests' }, 429);
  const body = await c.req.json().catch(() => null);
  const word = clean(body?.word, MAX_WORD);
  const sentence = clean(body?.sentence, MAX_TEXT);
  const title = clean(body?.title, MAX_TITLE) ?? '';
  const context = clean(body?.context, MAX_TEXT) ?? sentence;
  if (!word || !sentence) return c.json({ error: 'word and sentence are required' }, 400);

  const key = `lookup:v1:${c.env.LOOKUP_MODEL}:${await sha(`${word}|${sentence}`)}`;
  const hit = await c.env.CACHE?.get(key, 'json');
  if (hit) return c.json({ lookup: hit as Lookup, cached: true });

  if (!(await withinDailyCap(c.env)))
    return c.json({ error: 'The daily limit for lookups is used up. Try again tomorrow.' }, 429);
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
    return c.json({ lookup, cached: false });
  } catch {
    return c.json({ error: 'Lookup failed. Try again.' }, 502);
  }
});

app.post('/api/translate', async (c) => {
  if (tooMany(c.req.header('cf-connecting-ip') ?? 'local'))
    return c.json({ error: 'Too many requests' }, 429);
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

  const model = c.env.TRANSLATE_MODEL || c.env.LOOKUP_MODEL;
  const key = `translate:v2:${model}:${await sha(`${text}|${words.join(' ')}`)}`;
  const hit = await c.env.CACHE?.get(key, 'json');
  if (hit) return c.json({ ...(hit as Translation), cached: true });

  if (!(await withinDailyCap(c.env)))
    return c.json({ error: 'The daily limit for translations is used up. Try again tomorrow.' }, 429);
  try {
    const numbered = words.map((w, i) => `${i + 1}. ${w}`).join('\n');
    const raw = await askModel(
      c.env,
      model,
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

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
