import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { setTopics, topics } from '../lib/habit.ts';
import { allTexts } from '../lib/path.ts';
import { getIndex } from '../lib/texts.ts';

const HOW_MANY = 3;

/** Pick the topics that come first in Up next. */
export function Topics() {
  const [index] = createResource(getIndex);
  const editing = topics() !== null;
  const [picked, setPicked] = createSignal<string[]>(topics() ?? []);
  const shown = createMemo(() => {
    const i = index();
    if (!i) return [];
    const texts = allTexts(i);
    return i.topics.filter((t) => texts.some((x) => x.topics.includes(t.key)));
  });
  const toggle = (key: string) =>
    setPicked(
      picked().includes(key) ? picked().filter((k) => k !== key) : [...picked(), key].slice(-HOW_MANY),
    );
  const left = () => HOW_MANY - picked().length;
  return (
    <div class="tpage">
      <Show when={editing}>
        <a href="#/" class="signin-link">
          ‹ Today
        </a>
      </Show>
      <div class="cap" style={{ 'margin-top': editing ? '18px' : '0' }}>
        {editing ? 'Your topics' : 'Last question'}
      </div>
      <h1 class="serif th">What do you like to read about?</h1>
      <p class="msub">Pick three. We will put these first.</p>
      <div class="toc" role="group" aria-label="Topics">
        <For each={shown()}>
          {(t) => (
            <button type="button" aria-pressed={picked().includes(t.key)} onClick={() => toggle(t.key)}>
              <span class="box" aria-hidden="true">
                ✓
              </span>
              <span>{t.label}</span>
            </button>
          )}
        </For>
      </div>
      <div class="tfoot">
        <button
          type="button"
          class="btn p wide"
          disabled={left() > 0}
          onClick={() => {
            setTopics(picked());
            location.hash = '#/';
          }}
        >
          {left() > 0 ? `Pick ${left()} more` : editing ? 'Save topics' : 'Start reading'}
        </button>
      </div>
    </div>
  );
}
