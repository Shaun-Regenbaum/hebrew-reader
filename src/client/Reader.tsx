import { createEffect, createResource, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { getPref, setPref } from '../lib/prefs.ts';
import { sentenceAt, wordsInSentence } from '../lib/sentence.ts';
import { markSectionRead, touchText } from '../lib/store.ts';
import { getMeta, getSection } from '../lib/texts.ts';
import type { Para, TextKind } from '../lib/types.ts';
import { ParaView, type Range, type Tap } from './ParaView.tsx';
import { createPager } from './pager.ts';
import { ReaderBar } from './ReaderBar.tsx';
import { SHEET_ROOM, SIZES, type View } from './reader-view.ts';
import { type SheetState, WordSheet } from './WordSheet.tsx';

export function Reader(props: { kind: TextKind; id: string; section: number; end: boolean }) {
  const [data] = createResource(
    () => ({ k: props.kind, i: props.id, s: props.section }),
    async (x) => ({ meta: await getMeta(x.k, x.i), paras: await getSection(x.k, x.i, x.s) }),
  );
  const sections = () => data()?.meta.sections ?? 1;
  const here = () => `${props.kind}/${props.id}`;
  const go = (n: number, end = false) => `#/read/${here()}/${n}${end ? '/end' : ''}`;

  // ---- what the learner has chosen ----
  const [view, setView] = createSignal<View>(getPref<View>('hr:view', ['scroll', 'page'], 'scroll'));
  const [size, setSize] = createSignal(Number(getPref('hr:sz', ['0', '1', '2', '3'], '1')));
  const [hints, setHints] = createSignal(getPref('hr:hints', ['on', 'off'], 'on') === 'on');

  // ---- the open lookup, if any ----
  const [tap, setTap] = createSignal<Tap | null>(null);
  const [sheet, setSheet] = createSignal<SheetState | null>(null);
  const [range, setRange] = createSignal<Range | null>(null);
  const [glosses, setGlosses] = createSignal<Map<string, string>>(new Map());

  const pager = createPager({
    active: () => view() === 'page',
    layout: () => [data(), view(), size()],
    section: () => [props.id, props.section],
    startAtEnd: () => props.end,
    nextSection: () =>
      props.section < sections() - 1 ? () => (location.hash = go(props.section + 1)) : undefined,
    prevSection: () => (props.section > 0 ? () => (location.hash = go(props.section - 1, true)) : undefined),
    blocked: () => !!sheet(),
  });

  /** Close the lookup and put the text back as it was: no tapped word, no highlighted sentence, no selection. */
  function close() {
    setSheet(null);
    setTap(null);
    setRange(null);
    pager.setShiftY(0);
    setGlosses(new Map());
    window.getSelection()?.removeAllRanges();
  }
  createEffect(on(() => [props.id, props.section], close, { defer: true }));

  const toggleHints = () => {
    setHints(!hints());
    setPref('hr:hints', hints() ? 'on' : 'off');
  };
  const toggleView = () => {
    const v: View = view() === 'scroll' ? 'page' : 'scroll';
    close();
    setView(v);
    setPref('hr:view', v);
    window.scrollTo(0, 0);
  };
  const cycleSize = () => {
    setSize((size() + 1) % SIZES[view()].length);
    setPref('hr:sz', String(size()));
  };
  const onGloss = (g: { p: number; wis: number[]; glosses: string[] } | null) => {
    const m = new Map<string, string>();
    g?.wis.forEach((wi, i) => {
      const gloss = g.glosses[i];
      if (gloss) m.set(`${g.p}:${wi}`, gloss);
    });
    setGlosses(m);
  };

  // ---- how far along the learner is ----
  const [scrolled, setScrolled] = createSignal(0);
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    // a short section has nothing to scroll, so it counts as fully scrolled
    setScrolled(max > 8 ? Math.min(1, window.scrollY / max) : 1);
  };
  createEffect(() => {
    if (data()) touchText(props.kind, props.id, props.section);
  });
  createEffect(() => {
    if (data()) requestAnimationFrame(onScroll);
  });
  // A section counts as read once the learner reaches its end.
  createEffect(() => {
    if (!data()) return;
    const atEnd = view() === 'page' ? pager.atEnd() : scrolled() >= 0.9;
    if (atEnd) markSectionRead(props.kind, props.id, props.section);
  });
  const progress = () => {
    const within = view() === 'page' ? pager.fraction() : scrolled();
    return ((props.section + within) / sections()) * 100;
  };

  // ---- taps ----
  /** Keep the tapped word above the sheet. */
  function keepVisible(el: HTMLElement) {
    const limit = window.innerHeight - SHEET_ROOM;
    const bottom = el.getBoundingClientRect().bottom;
    if (bottom <= limit) return;
    const dy = bottom - limit + 16;
    if (view() === 'page') pager.setShiftY(pager.shiftY() + dy);
    else window.scrollBy({ top: dy, behavior: 'smooth' });
  }

  function openWord(el: HTMLElement, para: Para) {
    const p = Number(el.dataset.p);
    const wi = Number(el.dataset.i);
    const [start, end] = para.w[wi] as [number, number];
    const sentence = sentenceAt(para.t, start);
    const wis = wordsInSentence(para.w, sentence);
    setTap({ p, wi });
    setRange(null);
    setSheet({
      id: `${props.kind}:${props.id}:${props.section}:${p}:${start}`,
      word: para.t.slice(start, end),
      p,
      sentence,
      context: para.t.slice(0, 1400),
      words: wis.map((i) => para.t.slice(...(para.w[i] as [number, number]))),
      wis,
    });
    keepVisible(el);
  }

  const onClick = (e: MouseEvent) => {
    if (pager.swiped()) return;
    // Read the click's path now: a button that redraws itself is already detached by the time we look,
    // and a detached button looks like "clicked outside".
    const path = e.composedPath().filter((n): n is HTMLElement => n instanceof HTMLElement);
    const inside = (sel: string) => path.find((n) => n.matches(sel));
    // the sheet, the top bar and the footer handle their own clicks
    if (inside('.sheet, .rtop, .pfoot, .endnav, .credit a')) return;
    const word = inside('.w');
    const para = word ? data()?.paras[Number(word.dataset.p)] : undefined;
    if (word && para) {
      openWord(word, para);
    } else if (sheet()) {
      // anywhere else, with a lookup open: close it and do nothing more
      close();
    } else if (view() === 'page') {
      pager.tapZone(e.clientX);
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (view() === 'page' && e.key === 'ArrowLeft') pager.next();
    else if (view() === 'page' && e.key === 'ArrowRight') pager.prev();
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

  const Bar = () => (
    <ReaderBar
      title={data()?.meta.title}
      view={view()}
      hints={hints()}
      onToggleHints={toggleHints}
      onToggleView={toggleView}
      onCycleSize={cycleSize}
    />
  );
  const Paras = (d: { paras: Para[] }) => (
    <For each={d.paras}>
      {(para, pi) => (
        <ParaView
          para={para}
          pi={pi()}
          prefix={`${here().replace('/', ':')}:${props.section}`}
          hints={hints}
          tap={tap}
          range={range}
          glosses={glosses}
        />
      )}
    </For>
  );

  return (
    <div style={{ '--read': `${SIZES[view()][size()]}px` }}>
      <div class="progress">
        <i style={{ width: `${progress()}%` }} />
      </div>
      <Show when={data.error}>
        <Bar />
        <div class="empty">Could not load this text.</div>
      </Show>
      <Show when={data()}>
        {(d) => {
          const credit = d().meta.credit;
          return (
            <Show
              when={view() === 'page'}
              fallback={
                <>
                  <Bar />
                  <div class="he read" lang="he" dir="rtl">
                    <Paras paras={d().paras} />
                  </div>
                  <div class="endnav">
                    <Show when={props.section > 0} fallback={<span />}>
                      <a class="btn" href={go(props.section - 1)}>
                        ← Previous
                      </a>
                    </Show>
                    <Show when={props.section < sections() - 1}>
                      <a class="btn p" href={go(props.section + 1)}>
                        Next section →
                      </a>
                    </Show>
                  </div>
                  <div class="credit">
                    {credit.name} ·{' '}
                    <a href={credit.url} target="_blank" rel="noopener noreferrer">
                      source
                    </a>{' '}
                    · {credit.license}
                  </div>
                  <div style={{ height: sheet() ? '320px' : '60px' }} />
                </>
              }
            >
              <div class="pagemode">
                <Bar />
                <div
                  class="pview"
                  ref={pager.refs.view}
                  onTouchStart={pager.swipe.onTouchStart}
                  onTouchEnd={pager.swipe.onTouchEnd}
                >
                  <div class="pclip" ref={pager.refs.clip}>
                    <div
                      class="pcols he"
                      ref={pager.refs.cols}
                      lang="he"
                      dir="rtl"
                      style={{
                        width: pager.colW() ? `${pager.colW()}px` : undefined,
                        'column-width': pager.colW() ? `${pager.colW()}px` : undefined,
                        transform: `translate(${pager.offset()}px, ${-pager.shiftY()}px)`,
                      }}
                    >
                      <Paras paras={d().paras} />
                    </div>
                  </div>
                </div>
                <div class="pfoot">
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={!pager.canNext()}
                    onClick={pager.next}
                  >
                    ←
                  </button>
                  <div class="mid">
                    Page {pager.page() + 1} of {pager.pages()}
                    {sections() > 1 ? ` · section ${props.section + 1} of ${sections()}` : ''}
                    <br />
                    <a href={credit.url} target="_blank" rel="noopener noreferrer">
                      {credit.name}
                    </a>{' '}
                    · {credit.license}
                  </div>
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={!pager.canPrev()}
                    onClick={pager.prev}
                  >
                    →
                  </button>
                </div>
              </div>
            </Show>
          );
        }}
      </Show>
      <Show when={sheet()} keyed>
        {(s) => (
          <WordSheet
            sheet={s}
            text={{ kind: props.kind, id: props.id, title: data()?.meta.title ?? '' }}
            onRange={setRange}
            onGloss={onGloss}
            onClose={close}
          />
        )}
      </Show>
    </div>
  );
}
