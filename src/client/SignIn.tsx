import { createSignal, Show } from 'solid-js';
import { verifyLink } from '../lib/account.ts';

/** The page an emailed link opens. It asks for one click, so a mail scanner that opens the link cannot use it up. */
export function SignIn(props: { token: string }) {
  const [state, setState] = createSignal<'ready' | 'working' | 'error'>('ready');
  const [error, setError] = createSignal('');

  async function go() {
    setState('working');
    try {
      await verifyLink(props.token);
      location.hash = '#/account';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This link is not valid');
      setState('error');
    }
  }

  return (
    <div class="hsec" style={{ 'padding-top': '120px', 'text-align': 'center' }}>
      <div class="serif acc-title">Sign in to Read Hebrew</div>
      <Show
        when={state() !== 'error'}
        fallback={
          <>
            <div class="err" role="alert">
              {error()}
            </div>
            <a class="btn p" href="#/account" style={{ 'margin-top': '20px' }}>
              Ask for a new link
            </a>
          </>
        }
      >
        <p class="acc-text">Press the button to finish signing in on this device.</p>
        <button
          type="button"
          class="btn p"
          disabled={state() === 'working'}
          onClick={go}
          style={{ 'margin-top': '12px' }}
        >
          {state() === 'working' ? 'Signing in…' : 'Sign in'}
        </button>
      </Show>
    </div>
  );
}
