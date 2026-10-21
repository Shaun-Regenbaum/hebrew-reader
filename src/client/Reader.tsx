import { type Accessor, createEffect, createMemo, createResource, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { normalizeWord, sentenceAt } from '../lib/sentence.ts';
import { rememberPosition, seenWords } from '../lib/store.ts';
import { getMeta, getSection } from '../lib/texts.ts';
import type { Para, TextKind } from '../lib/types.ts';
import { type SheetState, WordSheet } from './WordSheet.tsx';

interface Range { p: number; start: number; end: number }
interface Seg { word: boolean; text: string; start: number; end: number; wi: number }
type View = 'scroll' | 'page';

const SIZES = [21, 23, 25, 28];
/** Room the open sheet takes at the bottom of the screen, so the tapped word can be kept above it. */
const SHEET_ROOM = 300;

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

function stored<T extends string>(key: string, ok: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && ok.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const IconScroll = () => (
  <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14" /><path d="M12 2v2M12 20v2" /></svg>
);
const IconPage = () => (
  <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h6a2 2 0 012 2v12a2 2 0 00-2-2H4V5zM20 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6V5z" /></svg>
);

export function Reader(props: { kind: TextKind; id: string; section: number; end: boolean }) {
  const [data] = createResource(
    () => ({ k: props.kind, i: props.id, s: props.section }),
    async (x) => ({ meta: await getMeta(x.k, x.i), paras: await getSection(x.k, x.i, x.s) }),
  );
  const [tap, setTap] = createSignal<{ p: number; wi: number } | null>(null);
  const [sheet, setSheet] = createSignal<SheetState | null>(null);
  const [range, setRange] = createSignal<Range | null>(null);
  const [frac, setFrac] = createSignal(0);
  const [size, setSize] = createSignal(Math.max(0, SIZES.indexOf(Number(stored('hr:size', ['21', '23', '25', '28'], '23')))));
  const [view, setView] = createSignal<View>(stored<View>('hr:view', ['scroll', 'page'], 'scroll'));

  // page view state
  const [page, setPage] = createSignal(0);
  const [pages, setPages] = createSignal(1);
  const [colW, setColW] = createSignal(0);
  const [shiftY, setShiftY] = createSignal(0);
  let viewEl: HTMLDivElement | undefined;
  let clipEl: HTMLDivElement | undefined;
  let colsEl: HTMLDivElement | undefined;

  const cycleSize = () => {
    const n = (size() + 1) % SIZES.length;
    setSize(n);
    store('hr:size', String(SIZES[n]));
  };
  const toggleView = () => {
    const v: View = view() === 'scroll' ? 'page' : 'scroll';
    close();
    setView(v);
    store('hr:view', v);
    window.scrollTo(0, 0);
  };

  /** Close the lookup and put the text back as it was: no tapped word, no highlighted sentence, no selection. */
  function close() {
    setSheet(null);
    setTap(null);
    setRange(null);
    setShiftY(0);
    window.getSelection()?.removeAllRanges();
  }
  createEffect(on(() => [props.id, props.section], close, { defer: true }));
  createEffect(() => {
    if (data()) rememberPosition({ kind: props.kind, id: props.id, section: props.section });
  });

  // ---- page view: lay the text out in columns as wide as the screen, then slide between them ----
  const measure = () => {
    if (view() !== 'page' || !clipEl || !colsEl) return;
    const w = clipEl.clientWidth;
    if (w <= 0) return;
    setColW(w);
    requestAnimationFrame(() => {
      if (!colsEl) return;
      setPages(Math.max(1, Math.round(colsEl.scrollWidth / w)));
      setPage((p) => Math.min(p, pages() - 1));
    });
  };
  createEffect(
    on([() => data(), view, size], () => {
      if (view() !== 'page') return;
      // wait for the columns to exist, then count the pages
      queueMicrotask(() => requestAnimationFrame(() => {
        measure();
        requestAnimationFrame(() => {
          if (props.end) setPage(pages() - 1);
        });
      }));
    }),
  );
  createEffect(on(() => [props.id, props.section], () => setPage(0), { defer: true }));
  onMount(() => {
    const ro = new ResizeObserver(measure);
    if (clipEl) ro.observe(clipEl);
    void document.fonts?.ready.then(measure);
    onCleanup(() => ro.disconnect());
  });

  const go = (n: number, end = false) => `#/read/${props.kind}/${props.id}/${n}${end ? '/end' : ''}`;
  const sections = () => data()?.meta.sections ?? 1;
  function next() {
    if (page() < pages() - 1) setPage(page() + 1);
    else if (props.section < sections() - 1) location.hash = go(props.section + 1);
  }
  function prev() {
    if (page() > 0) setPage(page() - 1);
    else if (props.section > 0) location.hash = go(props.section - 1, true);
  }
  const canNext = () => page() < pages() - 1 || props.section < sections() - 1;
  const canPrev = () => page() > 0 || props.section > 0;

  // swipe: in a Hebrew book the next page is turned from the left edge toward the right
  let touchX: number | null = null;
  const onTouchStart = (e: TouchEvent) => { touchX = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: TouchEvent) => {
    const x = e.changedTouches[0]?.clientX;
    if (touchX === null || x === undefined) return;
    const dx = x - touchX;
    touchX = null;
    if (Math.abs(dx) > 50 && !sheet()) {
      if (dx > 0) next();
      else prev();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 350);
    }
  };
  let suppressClick = false;

  // ---- scroll view progress ----
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    setFrac(max > 0 ? Math.min(1, window.scrollY / max) : 0);
  };

  // ---- taps ----
  /** Keep the tapped word above the sheet. */
  function keepVisible(el: HTMLElement) {
    const limit = window.innerHeight - SHEET_ROOM;
    const bottom = el.getBoundingClientRect().bottom;
    if (bottom <= limit) return;
    const dy = bottom - limit + 16;
    if (view() === 'page') setShiftY(shiftY() + dy);
    else window.scrollBy({ top: dy, behavior: 'smooth' });
  }

  const onClick = (e: MouseEvent) => {
    if (suppressClick) return;
    const t = e.target as HTMLElement;
    // the sheet, the top bar and the footer handle their own clicks
    if (t.closest('.sheet, .rtop, .pfoot, .endnav, .credit a')) return;
    const el = t.closest<HTMLElement>('.w');
    const para = el ? data()?.paras[Number(el.dataset.p)] : undefined;
    if (el && para) {
      const p = Number(el.dataset.p);
      const wi = Number(el.dataset.i);
      const [s, e2] = para.w[wi] as [number, number];
      setTap({ p, wi });
      setRange(null);
      setSheet({ id: `${props.kind}:${props.id}:${props.section}:${p}:${s}`, word: para.t.slice(s, e2), p, sentence: sentenceAt(para.t, s) });
      keepVisible(el);
      return;
    }
    // anywhere else: if a lookup is open, close it and nothing more
    if (sheet()) {
      close();
      return;
    }
    // page view: tap the left third for the next page, the right third for the previous one
    if (view() === 'page' && viewEl) {
      const r = viewEl.getBoundingClientRect();
      const f = (e.clientX - r.left) / r.width;
      if (f < 0.33) next();
      else if (f > 0.67) prev();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (view() === 'page' && e.key === 'ArrowLeft') next();
    else if (view() === 'page' && e.key === 'ArrowRight') prev();
  };
  onMount(() => {
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    onCleanup(() => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    });
  });

  const progress = () => {
    const n = sections();
    const within = view() === 'page' ? (pages() > 1 ? page() / pages() : 0) : frac();
    return ((props.section + within) / n) * 100;
  };

  const Header = () => (
    <div class="rtop">
      <a class="iconbtn" href="#/" aria-label="Back to library">
        <svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
      </a>
      <div class="t he">{data()?.meta.title}</div>
      <div class="tools">
        <button class="iconbtn" aria-label={view() === 'scroll' ? 'Switch to page view' : 'Switch to scroll view'} onClick={toggleView}>
          {view() === 'scroll' ? <IconPage /> : <IconScroll />}
        </button>
        <button class="aa" aria-label="Change text size" onClick={cycleSize}>Aa</button>
      </div>
    </div>
  );

  const Paras = (d: { paras: Para[] }) => <For each={d.paras}>{(para, pi) => <ParaView para={para} pi={pi()} tap={tap} range={range} />}</For>;

  return (
    <div style={{ '--read': `${SIZES[size()]}px` }}>
      <div class="progress"><i style={{ width: `${progress()}%` }} /></div>
      <Show when={data.error}><Header /><div class="empty">Could not load this text.</div></Show>
      <Show when={data()}>
        {(d) => (
          <Show
            when={view() === 'page'}
            fallback={
              <>
                <Header />
                <div class="he read" lang="he" dir="rtl"><Paras paras={d().paras} /></div>
                <div class="endnav">
                  <Show when={props.section > 0} fallback={<span />}><a class="btn" href={go(props.section - 1)}>← Previous</a></Show>
                  <Show when={props.section < d().meta.sections - 1}><a class="btn p" href={go(props.section + 1)}>Next section →</a></Show>
                </div>
                <div class="credit">
                  {d().meta.credit.name} · <a href={d().meta.credit.url} target="_blank" rel="noopener noreferrer">source</a> · {d().meta.credit.license}
                </div>
                <div style={{ height: sheet() ? '320px' : '60px' }} />
              </>
            }
          >
            <div class="pagemode">
              <Header />
              <div class="pview" ref={viewEl} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                <div class="pclip" ref={clipEl}>
                <div
                  class="pcols he"
                  ref={colsEl}
                  lang="he"
                  dir="rtl"
                  style={{
                    width: colW() ? `${colW()}px` : undefined,
                    'column-width': colW() ? `${colW()}px` : undefined,
                    transform: `translate(${page() * colW()}px, ${-shiftY()}px)`,
                  }}
                >
                  <Paras paras={d().paras} />
                </div>
                </div>
              </div>
              <div class="pfoot">
                <button aria-label="Next page" disabled={!canNext()} onClick={next}>←</button>
                <div class="mid">
                  Page {page() + 1} of {pages()}{sections() > 1 ? ` · section ${props.section + 1} of ${sections()}` : ''}
                  <br />
                  <a href={d().meta.credit.url} target="_blank" rel="noopener noreferrer">{d().meta.credit.name}</a> · {d().meta.credit.license}
                </div>
                <button aria-label="Previous page" disabled={!canPrev()} onClick={prev}>→</button>
              </div>
            </div>
          </Show>
        )}
      </Show>
      <Show when={sheet()} keyed>
        {(s) => <WordSheet sheet={s} text={{ kind: props.kind, id: props.id, title: data()?.meta.title ?? '' }} onRange={setRange} onClose={close} />}
      </Show>
    </div>
  );
}
