import { Show } from 'solid-js';
import { email } from '../lib/account.ts';
import { dayKey, minutesRead, streak } from '../lib/daily.ts';
import { closeDone, days, goal } from '../lib/habit.ts';
import { lookups } from '../lib/store.ts';

const startOfToday = () => new Date().setHours(0, 0, 0, 0);

const go = (hash: string) => {
  closeDone();
  location.hash = hash;
};

/** Shown the moment today's reading goal is met. */
export function DoneScreen() {
  const key = () => new Date();
  const minutes = () => minutesRead(days()[dayKey(key())]?.s ?? 0);
  const newWords = () =>
    new Set(
      lookups()
        .filter((l) => l.at >= startOfToday())
        .map((l) => l.lemma),
    ).size;
  const saved = () => new Set(lookups().map((l) => l.lemma)).size;
  return (
    <div class="doneover" role="dialog" aria-label="Done for today">
      <div class="donepage">
        <div class="inscr he" lang="he">
          סיימת להיום
        </div>
        <h1 class="serif dh">Done for today</h1>
        <p class="msub">You read for {Math.max(minutes(), goal() ?? 0)} minutes.</p>
        <div class="stats">
          <div>
            <b class="serif">{streak(days(), key())}</b>
            <span>{streak(days(), key()) === 1 ? 'day in a row' : 'days in a row'}</span>
          </div>
          <div>
            <b class="serif">{newWords()}</b>
            <span>{newWords() === 1 ? 'new word today' : 'new words today'}</span>
          </div>
        </div>
        <div class="doneacts">
          <Show
            when={!email() && saved() > 0}
            fallback={
              <button type="button" class="btn p wide" onClick={() => go('#/')}>
                Back to Today
              </button>
            }
          >
            <button type="button" class="btn p wide" onClick={() => go('#/account')}>
              Keep my {saved()} {saved() === 1 ? 'word' : 'words'} on every device
            </button>
            <button type="button" class="btn wide" onClick={() => go('#/')}>
              Back to Today
            </button>
          </Show>
          <button type="button" class="linkbtn" onClick={closeDone}>
            Keep reading
          </button>
        </div>
      </div>
    </div>
  );
}
