import { onMount, Show } from 'solid-js';
import { isFirstVisit, setFlag } from '../lib/habit.ts';
import { FIRST_TEXT } from '../lib/path.ts';
import { progress } from '../lib/store.ts';
import { Today } from './Today.tsx';

/** The front door. Someone new goes straight into a story; everyone else sees their day. */
export function Front() {
  const first = isFirstVisit(Object.keys(progress()).length > 0);
  onMount(() => {
    if (!first) return;
    setFlag('started');
    location.replace(`#/read/${FIRST_TEXT.kind}/${FIRST_TEXT.id}/0`);
  });
  return (
    <Show when={!first}>
      <Today />
    </Show>
  );
}
