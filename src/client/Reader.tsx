import { type Accessor, createEffect, createMemo, createResource, createSignal, For, on, onCleanup, Show } from 'solid-js';
import { normalizeWord, sentenceAt } from '../lib/sentence.ts';
import { rememberPosition, seenWords } from '../lib/store.ts';
import { getMeta, getSection } from '../lib/texts.ts';
import type { Para, TextKind } from '../lib/types.ts';
import { type SheetState, WordSheet } from './WordSheet.tsx';

interface Range { p: number; start: number; end: number }
interface Seg { word: boolean; text: string; start: number; end: number; wi: number }

const SIZES = [21, 23, 25, 28];

function segments(para: Para): Seg[] {
  const out: Seg[] = [];
  let at = 0;
  para.w.forEach(([s, e], wi) => {
    if (s > at) out.push({ word: false, text: para.t.slice(at, s), start: at, end: s, wi: -1 });
    out.push({ word: true, text: para.t.slice(s, e), start: s, end: e, wi });
    at = e;
  });
  if (at < para.t.length) out.push({ word: false, text: para.t.slice(at), start: at, end: para.t.length, wi: -1 });
  return out;
}

function ParaView(props: { para: Para; pi: number; tap: Accessor<{ p: number; wi: number } | null>; range: Accessor<Range | null> }) {
  const segs = createMemo(() => segments(props.para));
  const inRange = (s: Seg) => {
    const r = props.range();
    return !!r && r.p === props.pi && s.start >= r.start && s.end <= r.end;
  };
  return (
    <p classList={{ hd: !!props.para.h }}>
      <For each={segs()}>
        {(s) =>
          s.word ? (
            <span
              class="w"
              data-p={props.pi}
              data-i={s.wi}
              classList={{
                seen: seenWords().has(normalizeWord(s.text)),
                tap: props.tap()?.p === props.pi && props.tap()?.wi === s.wi,
                sent: inRange(s),
              }}
            >
              {s.text}
            </span>
          ) : (
            <span classList={{ sent: inRange(s) }}>{s.text}</span>
          )
        }
      </For>
    </p>
  );
}

export function Reader(props: { kind: TextKind; id: string; section: number }) {
  const [data] = createResource(
    () => ({ k: props.kind, i: props.id, s: props.section }),
    async (x) => ({ meta: await getMeta(x.k, x.i), paras: await getSection(x.k, x.i, x.s) }),
  );
  const [tap, setTap] = createSignal<{ p: number; wi: number } | null>(null);
  const [sheet, setSheet] = createSignal<SheetState | null>(null);
  const [range, setRange] = createSignal<Range | null>(null);
  const [frac, setFrac] = createSignal(0);
  const [size, setSize] = createSignal(1);

  try {
    const s = Number(localStorage.getItem('hr:size'));
    if (s >= 0 && s < SIZES.length) setSize(s);
  } catch {
    /* ignore */
  }
  const cycleSize = () => {
    const n = (size() + 1) % SIZES.length;
    setSize(n);
    try {
      localStorage.setItem('hr:size', String(n));
    } catch {
      /* ignore */
    }
  };

  const close = () => {
    setSheet(null);
    setTap(null);
    setRange(null);
  };
  createEffect(on(() => [props.id, props.section], close, { defer: true }));
  createEffect(() => {
    if (data()) rememberPosition({ kind: props.kind, id: props.id, section: props.section });
  });

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    setFrac(max > 0 ? Math.min(1, window.scrollY / max) : 0);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onCleanup(() => window.removeEventListener('scroll', onScroll));

  const onTap = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.w');
    const para = el ? data()?.paras[Number(el.dataset.p)] : undefined;
    if (!el || !para) {
      close();
      return;
    }
    const p = Number(el.dataset.p);
    const wi = Number(el.dataset.i);
    const [s, e2] = para.w[wi] as [number, number];
    setTap({ p, wi });
    setRange(null);
    setSheet({ id: `${props.kind}:${props.id}:${props.section}:${p}:${s}`, word: para.t.slice(s, e2), p, sentence: sentenceAt(para.t, s) });
  };

  const progress = () => {
    const n = data()?.meta.sections ?? 1;
    return ((props.section + frac()) / n) * 100;
  };
  const go = (n: number) => `#/read/${props.kind}/${props.id}/${n}`;

  return (
    <div style={{ '--read': `${SIZES[size()]}px` }}>
      <div class="progress"><i style={{ width: `${progress()}%` }} /></div>
      <div class="rtop">
        <a class="iconbtn" href="#/" aria-label="Back to library">
          <svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
        </a>
        <div class="t he">{data()?.meta.title}</div>
        <button class="aa" aria-label="Change text size" onClick={cycleSize}>Aa</button>
      </div>
      <Show when={data.error}><div class="empty">Could not load this text.</div></Show>
      <Show when={data()}>
        {(d) => (
          <>
            <div class="he read" lang="he" dir="rtl" onClick={onTap}>
              <For each={d().paras}>{(para, pi) => <ParaView para={para} pi={pi()} tap={tap} range={range} />}</For>
            </div>
            <div class="endnav">
              <Show when={props.section > 0} fallback={<span />}><a class="btn" href={go(props.section - 1)}>← Previous</a></Show>
              <Show when={props.section < d().meta.sections - 1}><a class="btn p" href={go(props.section + 1)}>Next section →</a></Show>
            </div>
            <div class="credit">
              {d().meta.credit.name} ·{' '}
              <a href={d().meta.credit.url} target="_blank" rel="noopener noreferrer">source</a> · {d().meta.credit.license}
            </div>
            <div style={{ height: sheet() ? '300px' : '60px' }} />
          </>
        )}
      </Show>
      <Show when={sheet()} keyed>
        {(s) => <WordSheet sheet={s} text={{ kind: props.kind, id: props.id, title: data()?.meta.title ?? '' }} onRange={setRange} onClose={close} />}
      </Show>
    </div>
  );
}
