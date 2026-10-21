/**
 * Read Hebrew Worker. Hono routes under /api, and everything else is the built client (the ASSETS binding).
 *   /api/lookup, /api/translate   the model (model.ts)
 *   /api/auth/*                   sign in by email link (auth.ts)
 *   /api/sync                     your data on every device (sync.ts)
 *   /api/stats/*                  anonymous word counts (stats.ts)
 */
import { Hono } from 'hono';
import { auth } from './auth.ts';
import type { AppEnv } from './env.ts';
import { model } from './model.ts';
import { stats } from './stats.ts';
import { sync } from './sync.ts';

const app = new Hono<AppEnv>();

// A request that changes something must come from this site (browsers send Origin on such requests).
app.use('/api/*', async (c, next) => {
  const origin = c.req.header('origin');
  if (c.req.method !== 'GET' && origin && new URL(origin).host !== new URL(c.req.url).host) {
    return c.json({ error: 'Cross-site request refused' }, 403);
  }
  await next();
});

app.route('/api', model);
app.route('/api/auth', auth);
app.route('/api/sync', sync);
app.route('/api/stats', stats);
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
