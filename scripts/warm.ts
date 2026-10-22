/**
 * Fill the answer cache for the start of a few texts, so the first taps in a demo are instant.
 *
 *   node scripts/warm.ts [--dry] [--limit N] [--words N] [--site URL]
 *
 * For each demo text it takes the first screen of section 0 (whole sentences, about --words words),
 * then asks the live site for every word's meaning and every sentence's translation, the same way the
 * reader does. The site saves each answer, so the reader finds it later. Needs WARM_TOKEN and
 * OPENROUTER_API_KEY in .dev.vars (the key is only used to read how much was spent).
 */
import { readFileSync } from 'node:fs';
import { sentenceAt, wordsInSentence } from '../src/lib/sentence.ts';

/** The demo set: the six shortest First steps stories, then Pinocchio, an article on black holes and one on elephants. */
const DEMO: [kind: string, id: string][] = [
  ['books', '52741'],
  ['books', '41866'],
  ['books', '11483'],
  ['books', '11495'],
  ['books', '11484'],
  ['books', '11472'],
  ['books', '11440'],
  ['articles', '207'],
  ['articles', '1141'],
];

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback: string) =>
  args.includes(`--${name}`) ? (args[args.indexOf(`--${name}`) + 1] ?? fallback) : fallback;
const dry = flag('dry');
const wordLimit = Number(opt('words', '130'));
const callLimit = flag('limit') ? Number(opt('limit', '0')) : Infinity;
const site = opt('site', 'https://learning.402.app');

const vars = Object.fromEntries(
  readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

interface Para {
  t: string;
  w: [number, number][];
}
interface Job {
  title: string;
  kind: string;
  id: string;
  lookups: { word: string; sentence: string; context: string }[];
  translations: { text: string; context: string; words: string[] }[];
}

function planText(kind: string, id: string): Job {
  const dir = new URL(`../public/texts/${kind}/${id}/`, import.meta.url);
  const title = (JSON.parse(readFileSync(new URL('meta.json', dir), 'utf8')) as { title: string }).title;
  const paras = JSON.parse(readFileSync(new URL('0.json', dir), 'utf8')) as Para[];
  const job: Job = { title, kind, id, lookups: [], translations: [] };
  const seen = new Set<string>();
  let words = 0;
  for (const para of paras) {
    let at = 0;
    while (at < para.t.length && words < wordLimit) {
      const sentence = sentenceAt(para.t, at);
      if (sentence.end <= at) break;
      at = sentence.end;
      const wis = wordsInSentence(para.w, sentence);
      if (!wis.length) continue;
      const surface = wis.map((i) => para.t.slice(...(para.w[i] as [number, number])));
      const context = para.t.slice(0, 1400);
      job.translations.push({ text: sentence.text, context, words: surface });
      for (const word of surface) {
        const key = `${word}|${sentence.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        job.lookups.push({ word, sentence: sentence.text, context });
      }
      words += wis.length;
    }
    if (words >= wordLimit) break;
  }
  return job;
}

async function post(path: string, body: unknown, tries = 3): Promise<{ cached?: boolean }> {
  for (let n = 1; ; n++) {
    const res = await fetch(`${site}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-warm': vars.WARM_TOKEN ?? '' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) return (await res.json()) as { cached?: boolean };
    if (n >= tries) throw new Error(`${path} failed (${res?.status ?? 'no response'})`);
    await new Promise((r) => setTimeout(r, 1500 * n));
  }
}

async function spent(): Promise<number> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${vars.OPENROUTER_API_KEY}` },
    });
    return ((await res.json()) as { data: { usage: number } }).data.usage;
  } catch {
    return Number.NaN;
  }
}

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await fn(items[next++] as T);
    }),
  );
}

const jobs = DEMO.map(([k, i]) => planText(k, i));
const nLookups = jobs.reduce((n, j) => n + j.lookups.length, 0);
const nTranslations = jobs.reduce((n, j) => n + j.translations.length, 0);
for (const j of jobs) {
  console.log(`${j.kind}/${j.id}  ${j.lookups.length} words, ${j.translations.length} sentences  ${j.title}`);
}
console.log(`total: ${nLookups} word lookups, ${nTranslations} sentence translations`);
if (dry) process.exit(0);

const before = await spent();
let calls = 0;
let fresh = 0;
let failed = 0;
const tasks: (() => Promise<void>)[] = [];
for (const j of jobs) {
  for (const l of j.lookups) {
    tasks.push(async () => {
      const r = await post('/api/lookup', { ...l, title: j.title });
      if (!r.cached) fresh++;
    });
  }
  for (const t of j.translations) {
    tasks.push(async () => {
      const r = await post('/api/translate', { ...t, title: j.title });
      if (!r.cached) fresh++;
    });
  }
}
await pool(tasks.slice(0, callLimit), 4, async (run) => {
  calls++;
  await run().catch((e: Error) => {
    failed++;
    console.error(e.message);
  });
});
const cost = (await spent()) - before;
console.log(`${calls} calls, ${fresh} new answers, ${failed} failed, spent $${cost.toFixed(4)}`);
if (fresh) console.log(`about $${(cost / fresh).toFixed(4)} per new answer`);
