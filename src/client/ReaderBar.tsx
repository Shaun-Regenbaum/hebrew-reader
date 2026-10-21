import type { View } from './reader-view.ts';

const IconScroll = () => (
  <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 6h14M5 12h14M5 18h14" />
    <path d="M12 2v2M12 20v2" />
  </svg>
);
const IconPage = () => (
  <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 5h6a2 2 0 012 2v12a2 2 0 00-2-2H4V5zM20 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6V5z" />
  </svg>
);
const IconEye = () => (
  <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

/** The reader's top bar: back, the title, and the three reading controls. */
export function ReaderBar(props: {
  title?: string;
  view: View;
  hints: boolean;
  onToggleHints: () => void;
  onToggleView: () => void;
  onCycleSize: () => void;
}) {
  return (
    <div class="rtop">
      <a class="iconbtn" href="#/">
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        <span class="sr">Back to library</span>
      </a>
      <div class="t he">{props.title}</div>
      <div class="tools">
        <button
          type="button"
          class="iconbtn"
          classList={{ off: !props.hints }}
          aria-label={
            props.hints ? 'Hide hints above words you looked up' : 'Show hints above words you looked up'
          }
          aria-pressed={props.hints}
          onClick={props.onToggleHints}
        >
          <IconEye />
        </button>
        <button
          type="button"
          class="iconbtn"
          aria-label={props.view === 'scroll' ? 'Switch to page view' : 'Switch to scroll view'}
          onClick={props.onToggleView}
        >
          {props.view === 'scroll' ? <IconPage /> : <IconScroll />}
        </button>
        <button type="button" class="aa" aria-label="Change text size" onClick={props.onCycleSize}>
          Aa
        </button>
      </div>
    </div>
  );
}
