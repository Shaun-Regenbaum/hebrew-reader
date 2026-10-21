/**
 * One synced document per learner (lookups, known words, progress).
 *   GET /api/sync                        -> { data, updatedAt }
 *   PUT /api/sync { data, baseUpdatedAt } -> { updatedAt }, or 409 if another device saved first
 * The browser merges the two copies and tries again on a 409, so nothing is lost.
 */
import { Hono } from 'hono';
import { parseDoc } from '../lib/sync.ts';
import { requireUser } from './auth.ts';
import type { AppEnv } from './env.ts';
import { gunzip, gzip } from './util.ts';

/** D1 rows are limited to about 2 MB. */
const MAX_BYTES = 1_900_000;

export const sync = new Hono<AppEnv>();
sync.use('*', requireUser);

sync.get('/', async (c) => {
  const row = await c.env.DB.prepare('SELECT data, updated_at FROM sync_docs WHERE user_id = ?')
    .bind(c.get('user')?.id)
    .first<{ data: ArrayBuffer; updated_at: number }>();
  if (!row) return c.json({ data: null, updatedAt: 0 });
  return c.json({ data: JSON.parse(await gunzip(new Uint8Array(row.data))), updatedAt: row.updated_at });
});

sync.put('/', async (c) => {
  const userId = c.get('user')?.id;
  const body = await c.req.json().catch(() => null);
  const doc = parseDoc(body?.data);
  const base = Number(body?.baseUpdatedAt) || 0;
  if (!doc) return c.json({ error: 'That is not a Read Hebrew backup' }, 400);

  const packed = await gzip(JSON.stringify(doc));
  if (packed.byteLength > MAX_BYTES) return c.json({ error: 'Your data is too large to sync' }, 413);

  const updatedAt = Math.max(Date.now(), base + 1);
  const result =
    base === 0
      ? await c.env.DB.prepare(
          'INSERT INTO sync_docs (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO NOTHING',
        )
          .bind(userId, packed, updatedAt)
          .run()
      : await c.env.DB.prepare(
          'UPDATE sync_docs SET data = ?, updated_at = ? WHERE user_id = ? AND updated_at = ?',
        )
          .bind(packed, updatedAt, userId, base)
          .run();
  if (result.meta.changes !== 1) return c.json({ error: 'Another device saved first', conflict: true }, 409);
  return c.json({ updatedAt });
});
