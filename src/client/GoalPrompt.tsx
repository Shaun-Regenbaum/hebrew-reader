import { createSignal, For } from 'solid-js';
import { GOAL_CHOICES } from '../lib/daily.ts';
import { setGoal } from '../lib/habit.ts';

const LABEL: Record<number, string> = { 2: 'light', 5: 'steady', 10: 'serious' };

/** The one question we ask on the first visit, after the learner has seen a word open. */
export function GoalPrompt(props: { onDone: (goalSet: boolean) => void }) {
  const [pick, setPick] = createSignal<number>(5);
  return (
    <div class="modal" role="dialog" aria-label="Daily reading goal">
      <div class="mcard">
        <h2 class="serif mh">How much do you want to read each day?</h2>
        <p class="msub">You can change this any time.</p>
        <div class="opts">
          <For each={[...GOAL_CHOICES]}>
            {(m) => (
              <button type="button" class="opt" aria-pressed={pick() === m} onClick={() => setPick(m)}>
                <b class="serif">{m}</b>
                <span>min, {LABEL[m]}</span>
              </button>
            )}
          </For>
        </div>
        <button
          type="button"
          class="btn p wide"
          onClick={() => {
            setGoal(pick());
            props.onDone(true);
          }}
        >
          Set my goal
        </button>
        <button type="button" class="linkbtn" onClick={() => props.onDone(false)}>
          Not now
        </button>
      </div>
    </div>
  );
}
