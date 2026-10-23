import { createMemo, Show } from 'solid-js';
import { buildQueue } from '../lib/review.ts';
import { cards, known, lookups } from '../lib/store.ts';

export function Nav(props: { on: 'read' | 'review' | 'words' }) {
  const due = createMemo(() => buildQueue(lookups(), known(), cards()).items.length);
  return (
    <nav class="nav" aria-label="Main">
      <a href="#/" classList={{ on: props.on === 'read' }}>
        Read
      </a>
      <a href="#/review" classList={{ on: props.on === 'review' }}>
        Review
        <Show when={due() > 0 && props.on !== 'review'}>
          <span class="badge" aria-hidden="true">
            {due()}
          </span>
          <span class="sr">, {due()} cards to review</span>
        </Show>
      </a>
      <a href="#/words" classList={{ on: props.on === 'words' }}>
        Words
      </a>
    </nav>
  );
}
