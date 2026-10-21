import { createEffect, createRoot, createSignal, on } from 'solid-js';
import { readJson, writeJson } from './prefs.ts';
import { applyDoc, localVersion, snapshot } from './store.ts';
import { emptyDoc, mergeDocs, parseDoc, sameDoc } from './sync.ts';

/** Who is signed in (their email), or null. */
const [email, setEmail] = createSignal<string | null>(null);
export type SyncStatus = 'idle' | 'syncing' | 'error';
const [status, setStatus] = createSignal<SyncStatus>('idle');
const [lastSynced, setLastSynced] = createSignal<number | null>(readJson<number | null>('hr:synced', null));
const [syncError, setSyncError] = createSignal('');

export { email, lastSynced, status, syncError };

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, body };
}
const post = (url: string, data: unknown) =>
  call<{ error?: string; email?: string; devLink?: string }>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

/** Ask the server who we are (the session lives in a cookie). */
export async function refreshMe(): Promise<void> {
  try {
    const r = await call<{ email?: string }>('/api/auth/me');
    setEmail(r.ok ? (r.body.email ?? null) : null);
  } catch {
    /* offline: keep what we knew */
  }
}

/** Ask for a sign-in link. In local development the server also returns the link itself. */
export async function requestLink(address: string): Promise<{ devLink?: string }> {
  const r = await post('/api/auth/request', { email: address });
  if (!r.ok) throw new Error(r.body.error ?? 'Could not send the link');
  return { devLink: r.body.devLink };
}

/** The page behind the emailed link calls this. */
export async function verifyLink(token: string): Promise<string> {
  const r = await post('/api/auth/verify', { token });
  if (!r.ok || !r.body.email) throw new Error(r.body.error ?? 'This link is not valid');
  setEmail(r.body.email);
  void syncNow();
  return r.body.email;
}

export async function logout(): Promise<void> {
  await post('/api/auth/logout', {});
  setEmail(null);
}

let running = false;
let again = false;

/**
 * Bring this device and the server together. Fetch the server's copy, merge it with ours, keep the merge here,
 * and save it back. If another device saved in between, the server says so and we go round again.
 */
export async function syncNow(): Promise<void> {
  if (!email()) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  setStatus('syncing');
  setSyncError('');
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const got = await call<{ data: unknown; updatedAt: number; error?: string }>('/api/sync');
      if (got.status === 401) {
        setEmail(null);
        return;
      }
      if (!got.ok) throw new Error(got.body.error ?? 'Sync failed');
      const remote = (got.body.data ? parseDoc(got.body.data) : null) ?? emptyDoc();
      const merged = mergeDocs(snapshot(), remote);
      applyDoc(merged);
      if (got.body.updatedAt > 0 && sameDoc(merged, remote)) break; // the server already has everything
      const put = await call<{ updatedAt?: number; error?: string }>('/api/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: merged, baseUpdatedAt: got.body.updatedAt }),
      });
      if (put.status === 409) continue;
      if (!put.ok) throw new Error(put.body.error ?? 'Sync failed');
      break;
    }
    const now = Date.now();
    setLastSynced(now);
    writeJson('hr:synced', now);
    setStatus('idle');
  } catch (e) {
    setSyncError(e instanceof Error ? e.message : 'Sync failed');
    setStatus('error');
  } finally {
    running = false;
    if (again) {
      again = false;
      void syncNow();
    }
  }
}

/** Sync when the learner changes something, when the app opens, and when the device comes back online. */
export function startAutoSync(): void {
  createRoot(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    createEffect(
      on(
        localVersion,
        () => {
          clearTimeout(timer);
          if (email()) timer = setTimeout(() => void syncNow(), 4000);
        },
        { defer: true },
      ),
    );
    window.addEventListener('online', () => void syncNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void syncNow();
    });
  });
  void refreshMe().then(() => syncNow());
}
