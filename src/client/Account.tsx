import { createSignal, Show } from 'solid-js';
import { email, lastSynced, logout, requestLink, status, syncError, syncNow } from '../lib/account.ts';
import { downloadBackup, loadBackup } from '../lib/backup.ts';
import { known, lookups, progress } from '../lib/store.ts';
import { Nav } from './Nav.tsx';

function ago(t: number | null): string {
  if (!t) return 'not yet';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 30) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

/** Sign in, see what is synced, and keep a backup file. Everything else in the app works without any of this. */
export function Account() {
  const [address, setAddress] = createSignal('');
  const [sent, setSent] = createSignal<{ to: string; devLink?: string } | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [note, setNote] = createSignal('');

  async function send(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await requestLink(address());
      setSent({ to: address().trim(), devLink: r.devLink });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the link');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setNote('');
    try {
      const added = await loadBackup(file);
      setNote(
        added > 0
          ? `Loaded. ${added} new ${added === 1 ? 'lookup' : 'lookups'} added.`
          : 'Loaded. Nothing new in that file.',
      );
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not load that file');
    }
  }

  return (
    <>
      <div class="top">
        <a class="iconbtn" href="#/words">
          <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span class="sr">Back to My words</span>
        </a>
        <div class="serif" style={{ 'font-size': '24px', 'font-weight': '500' }}>
          Account
        </div>
        <div style={{ width: '22px' }} />
      </div>

      <section class="hsec">
        <Show
          when={email()}
          fallback={
            <>
              <div class="serif acc-title">Keep your words on every device</div>
              <p class="acc-text">
                The app works without an account, and your words stay on this device. Sign in with your email
                to keep your words and progress on your phone and your laptop. We send you a link. There is no
                password.
              </p>
              <Show
                when={!sent()}
                fallback={
                  <div class="acc-card">
                    <b>Check your inbox</b>
                    <p class="acc-text" style={{ margin: '6px 0 0' }}>
                      We sent a link to {sent()?.to}. It works once, for 15 minutes.
                    </p>
                    <Show when={sent()?.devLink}>
                      <p class="acc-text">
                        Local test link: <a href={sent()?.devLink}>open</a>
                      </p>
                    </Show>
                    <button type="button" class="linkbtn" onClick={() => setSent(null)}>
                      Use a different email
                    </button>
                  </div>
                }
              >
                <form class="acc-form" onSubmit={send}>
                  <label class="sr" for="acc-email">
                    Email address
                  </label>
                  <input
                    id="acc-email"
                    class="acc-input"
                    type="email"
                    autocomplete="email"
                    placeholder="you@example.com"
                    required
                    value={address()}
                    onInput={(e) => setAddress(e.currentTarget.value)}
                  />
                  <button type="submit" class="btn p" disabled={busy()}>
                    {busy() ? 'Sending…' : 'Send me a link'}
                  </button>
                </form>
                <Show when={error()}>
                  <div class="err" role="alert">
                    {error()}
                  </div>
                </Show>
              </Show>
            </>
          }
        >
          <div class="acc-card">
            <div class="cap">Signed in</div>
            <div class="acc-email">{email()}</div>
            <div class="acc-row">
              <span class="hnote" style={{ margin: 0 }}>
                {status() === 'syncing'
                  ? 'Syncing…'
                  : status() === 'error'
                    ? `Sync problem: ${syncError()}`
                    : `Synced ${ago(lastSynced())}`}
              </span>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                class="btn"
                disabled={status() === 'syncing'}
                onClick={() => void syncNow()}
              >
                Sync now
              </button>
              <button type="button" class="btn" onClick={() => void logout()}>
                Sign out
              </button>
            </div>
          </div>
        </Show>
      </section>

      <section class="hsec">
        <div class="cap">On this device</div>
        <p class="acc-text">
          {lookups().length} {lookups().length === 1 ? 'lookup' : 'lookups'} · {known().length} known{' '}
          {known().length === 1 ? 'word' : 'words'} · {Object.keys(progress()).length}{' '}
          {Object.keys(progress()).length === 1 ? 'text' : 'texts'} started
        </p>
        <div class="acc-row">
          <button type="button" class="btn" onClick={downloadBackup}>
            Download a backup
          </button>
          <label class="btn" style={{ cursor: 'pointer' }}>
            Load a backup
            <input type="file" accept="application/json,.json" class="sr" onChange={onFile} />
          </label>
        </div>
        <Show when={note()}>
          <p class="hnote" role="status">
            {note()}
          </p>
        </Show>
        <p class="hnote">
          A backup is a file with your lookups, known words and progress. Loading one adds to what is here, it
          never erases it.
        </p>
      </section>
      <div class="pad-nav" />
      <Nav on="words" />
    </>
  );
}
