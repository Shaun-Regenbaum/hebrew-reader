/**
 * Sign in by email link, no password.
 *   POST /api/auth/request  { email }  -> emails a one-time link (always answers ok, so it never reveals who has an account)
 *   POST /api/auth/verify   { token }  -> the page behind the link calls this; sets the session cookie
 *   GET  /api/auth/me                  -> { email }, with email null when nobody is signed in
 *   POST /api/auth/logout
 * The link opens a page that asks for a click, instead of signing in on a plain GET, so mail scanners that
 * open links do not use the link up.
 */

import type { Context } from 'hono';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { sendLoginEmail } from './email.ts';
import type { AppEnv } from './env.ts';
import { clientIp, randomToken, sha256Hex, tooMany, validEmail, withinDailyCap } from './util.ts';

const COOKIE = 'hr_session';
const LINK_TTL_MS = 15 * 60_000;
const SESSION_TTL_MS = 90 * 24 * 3600_000;
const LINKS_PER_EMAIL_PER_HOUR = 3;

type Ctx = Context<AppEnv>;

function siteOrigin(c: Ctx): string {
  const here = new URL(c.req.url);
  const local = here.hostname === 'localhost' || here.hostname === '127.0.0.1';
  return local ? here.origin : (c.env.PUBLIC_URL ?? here.origin);
}

async function sessionUser(c: Ctx): Promise<{ id: string; email: string } | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const row = await c.env.DB.prepare(
    'SELECT u.id AS id, u.email AS email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
  )
    .bind(await sha256Hex(token), Date.now())
    .first<{ id: string; email: string }>();
  return row ?? null;
}

/** For routes that need a signed-in learner. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const user = await sessionUser(c);
  if (!user) return c.json({ error: 'Not signed in' }, 401);
  c.set('user', user);
  await next();
});

export const auth = new Hono<AppEnv>();

auth.post('/request', async (c) => {
  if (tooMany(`mail:${clientIp(c)}`, 5)) return c.json({ error: 'Too many requests' }, 429);
  const body = await c.req.json().catch(() => null);
  const email = validEmail(body?.email);
  if (!email) return c.json({ error: 'Enter a valid email address' }, 400);

  const now = Date.now();
  const recent = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM login_links WHERE email = ? AND created_at > ?',
  )
    .bind(email, now - 3600_000)
    .first<{ n: number }>();
  const allowed =
    (recent?.n ?? 0) < LINKS_PER_EMAIL_PER_HOUR &&
    (await withinDailyCap(c.env, 'mail', Number(c.env.EMAILS_PER_DAY) || 300));

  let devLink: string | undefined;
  if (allowed) {
    const token = randomToken();
    await c.env.DB.prepare(
      'INSERT INTO login_links (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
      .bind(await sha256Hex(token), email, now, now + LINK_TTL_MS)
      .run();
    const link = `${siteOrigin(c)}/#/signin/${token}`;
    if (c.env.DEV_SHOW_LINK === '1') devLink = link;
    else {
      try {
        await sendLoginEmail(c.env, email, link);
      } catch (e) {
        console.error('sign-in email failed', e);
        return c.json({ error: 'We could not send the email. Try again in a minute.' }, 502);
      }
    }
  }
  return c.json({ ok: true, ...(devLink ? { devLink } : {}) });
});

auth.post('/verify', async (c) => {
  if (tooMany(`verify:${clientIp(c)}`, 20)) return c.json({ error: 'Too many requests' }, 429);
  const body = await c.req.json().catch(() => null);
  const token = typeof body?.token === 'string' && body.token.length <= 200 ? body.token : null;
  if (!token) return c.json({ error: 'This link is not valid' }, 400);

  const now = Date.now();
  const hash = await sha256Hex(token);
  // Use the link up in one step, so two clicks cannot both win.
  const used = await c.env.DB.prepare(
    'UPDATE login_links SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
  )
    .bind(now, hash, now)
    .run();
  if (used.meta.changes !== 1)
    return c.json({ error: 'This link has expired or was already used. Ask for a new one.' }, 400);
  const link = await c.env.DB.prepare('SELECT email FROM login_links WHERE token_hash = ?')
    .bind(hash)
    .first<{ email: string }>();
  if (!link) return c.json({ error: 'This link is not valid' }, 400);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING',
  )
    .bind(randomToken(16), link.email, now)
    .run();
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(link.email)
    .first<{ id: string }>();
  if (!user) return c.json({ error: 'Could not sign you in' }, 500);

  const session = randomToken();
  await c.env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(await sha256Hex(session), user.id, now, now + SESSION_TTL_MS)
    .run();
  setCookie(c, COOKIE, session, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return c.json({ email: link.email });
});

auth.get('/me', async (c) => {
  const user = await sessionUser(c);
  return c.json({ email: user?.email ?? null });
});

auth.post('/logout', async (c) => {
  const token = getCookie(c, COOKIE);
  if (token)
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await sha256Hex(token))
      .run();
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});
