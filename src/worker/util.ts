import type { Env } from './env.ts';

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A random token that is safe to put in a link or a cookie. */
export function randomToken(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** A trimmed string no longer than max, or null. */
export const clean = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null;

// A per-isolate limiter: it slows a runaway client, it does not stop a determined one.
const hits = new Map<string, number[]>();
export function tooMany(key: string, perMinute: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > perMinute;
}
export const clientIp = (c: { req: { header(n: string): string | undefined } }) =>
  c.req.header('cf-connecting-ip') ?? 'local';

/** Count one use against today's cap for a named thing. KV is not atomic, so this is a soft limit. */
export async function withinDailyCap(env: Env, name: string, cap: number): Promise<boolean> {
  if (!env.CACHE) return true;
  const key = `cap:${name}:${new Date().toISOString().slice(0, 10)}`;
  const used = Number(await env.CACHE.get(key)) || 0;
  if (used >= cap) return false;
  await env.CACHE.put(key, String(used + 1), { expirationTtl: 172_800 });
  return true;
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Response(data as BodyInit).body?.pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
export const gzip = (s: string) => pipe(new TextEncoder().encode(s), new CompressionStream('gzip'));
export const gunzip = async (b: Uint8Array) =>
  new TextDecoder().decode(await pipe(b, new DecompressionStream('gzip')));

export function validEmail(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const e = s.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}
