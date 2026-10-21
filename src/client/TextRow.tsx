import { Show } from 'solid-js';
import { authorName } from '../lib/authors.ts';
import { isDone, keyOf, sectionsRead } from '../lib/path.ts';
import { progress } from '../lib/store.ts';
import type { Style, TextSummary } from '../lib/types.ts';

export const STYLE_LABEL: Record<Style, string> = {
  modern: 'Modern',
  literary: 'Literary',
  biblical: 'Biblical style',
};

export function LevelBars(props: { level: number }) {
  return (
    <span class="lvl" role="img" aria-label={`Level ${props.level} of 5`}>
      <span class="bars">
        {[1, 2, 3, 4, 5].map((n) => (
          <i classList={{ on: n <= props.level }} style={{ height: `${5 + n * 2}px` }} />
        ))}
      </span>
      Level {props.level}
    </span>
  );
}

/** "12 min", or "3 h" for a long read. */
export function readingTime(minutes: number): string {
  return minutes < 90 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}

/** One text, as a row: its title, what it is about, how hard it is, and how far you are. */
export function TextRow(props: { text: TextSummary; current?: boolean }) {
  const t = () => props.text;
  const done = () => isDone(t(), progress());
  const read = () => sectionsRead(t(), progress());
  const section = () => (done() ? 0 : (progress()[keyOf(t())]?.last ?? 0));
  return (
    <a class="trow" classList={{ cur: props.current }} href={`#/read/${t().kind}/${t().id}/${section()}`}>
      <div class="ttop">
        <span class="mark" classList={{ done: done(), part: !done() && read() > 0 }}>
          <Show
            when={done()}
            fallback={
              <Show when={read() > 0}>
                <span class="sr">In progress</span>
              </Show>
            }
          >
            <span class="sr">Finished</span>
            <svg
              aria-hidden="true"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 12l5 5 9-10" />
            </svg>
          </Show>
        </span>
        <span class="he ttitle">{t().title}</span>
      </div>
      <Show when={t().blurb}>
        <div class="tblurb">{t().blurb}</div>
      </Show>
      <div class="tchips">
        <LevelBars level={t().level} />
        <span>{readingTime(t().minutes)}</span>
        <span>{STYLE_LABEL[t().style]}</span>
        <span>{t().kind === 'articles' ? 'Article' : authorName(t().author)}</span>
      </div>
      <Show when={!done() && read() > 0 && t().sections > 1}>
        <div class="bar" style={{ 'margin-top': '10px' }}>
          <i style={{ width: `${(read() / t().sections) * 100}%` }} />
        </div>
      </Show>
    </a>
  );
}
