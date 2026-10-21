import { type Accessor, createMemo, For, Show } from 'solid-js';
import { normalizeWord } from '../lib/sentence.ts';
import { hintMeanings, seenWords, shortMeaning } from '../lib/store.ts';
import type { Para } from '../lib/types.ts';

export interface Range {
  p: number;
  start: number;
  end: number;
}
export interface Tap {
  p: number;
  wi: number;
}
interface Seg {
  word: boolean;
  text: string;
  start: number;
  end: number;
  wi: number;
}

/** Cut a paragraph into its words (tappable) and the text between them. */
function segments(para: Para): Seg[] {
  const out: Seg[] = [];
  let at = 0;
  para.w.forEach(([s, e], wi) => {
    if (s > at) out.push({ word: false, text: para.t.slice(at, s), start: at, end: s, wi: -1 });
    out.push({ word: true, text: para.t.slice(s, e), start: s, end: e, wi });
    at = e;
  });
  if (at < para.t.length) {
    out.push({ word: false, text: para.t.slice(at), start: at, end: para.t.length, wi: -1 });
  }
  return out;
}

/** One paragraph. Words you looked up are underlined and carry a quiet hint; the tapped word and the translated sentence are marked. */
export function ParaView(props: {
  para: Para;
  pi: number;
  /** "kind:id:section", to find this exact spot among saved lookups. */
  prefix: string;
  hints: Accessor<boolean>;
  tap: Accessor<Tap | null>;
  range: Accessor<Range | null>;
  /** English words to show over the Hebrew, keyed "paragraph:word". */
  glosses: Accessor<Map<string, string>>;
}) {
  const segs = createMemo(() => segments(props.para));
  const isTapped = (s: Seg) => props.tap()?.p === props.pi && props.tap()?.wi === s.wi;
  const inRange = (s: Seg) => {
    const r = props.range();
    return !!r && r.p === props.pi && s.start >= r.start && s.end <= r.end;
  };
  /** A quiet English hint for a word the learner has looked up before. */
  const hintFor = (s: Seg): string | undefined => {
    if (!props.hints() || isTapped(s)) return undefined;
    const m = hintMeanings();
    const meaning =
      m.byId.get(`${props.prefix}:${props.pi}:${s.start}`) ?? m.byWord.get(normalizeWord(s.text));
    return meaning ? shortMeaning(meaning) : undefined;
  };
  const wordClasses = (s: Seg) => ({
    seen: seenWords().has(normalizeWord(s.text)),
    tap: isTapped(s),
    sent: inRange(s),
  });

  return (
    <p classList={{ hd: !!props.para.h }}>
      <For each={segs()}>
        {(s) =>
          s.word ? (
            <Show
              when={props.glosses().get(`${props.pi}:${s.wi}`)}
              fallback={
                <span
                  class="w"
                  data-p={props.pi}
                  data-i={s.wi}
                  data-hint={hintFor(s)}
                  classList={wordClasses(s)}
                >
                  {s.text}
                </span>
              }
            >
              {(g) => (
                <ruby class="w" data-p={props.pi} data-i={s.wi} classList={wordClasses(s)}>
                  {s.text}
                  <rt>{g()}</rt>
                </ruby>
              )}
            </Show>
          ) : (
            <span classList={{ sent: inRange(s) }}>{s.text}</span>
          )
        }
      </For>
    </p>
  );
}
