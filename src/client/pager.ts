import { createEffect, createSignal, on, onCleanup, onMount } from 'solid-js';

/** Space between one page and the next, in pixels. */
const GAP = 16;

export interface PagerOptions {
  /** True while the page view is showing. */
  active: () => boolean;
  /** Changes whenever the text, the type size or the view changes, so the pages need counting again. */
  layout: () => unknown;
  /** Changes when the learner moves to another section. */
  section: () => unknown;
  /** Open on the last page, not the first (the learner came back from the next section). */
  startAtEnd: () => boolean;
  /** Turns to the next or previous section, or undefined when there is none. */
  nextSection: () => (() => void) | undefined;
  prevSection: () => (() => void) | undefined;
  /** True while something else (the word sheet) owns the screen: swipes are ignored. */
  blocked: () => boolean;
}

/**
 * The page view. The text is laid out in CSS columns exactly as wide as the screen, and we slide between them.
 * Hebrew reads right to left, so the next page is to the left: tap or swipe from the left edge, or press the left arrow.
 */
export function createPager(o: PagerOptions) {
  const [page, setPage] = createSignal(0);
  const [pages, setPages] = createSignal(1);
  const [colW, setColW] = createSignal(0);
  /** Lifts the page when the word sheet would cover the tapped word. */
  const [shiftY, setShiftY] = createSignal(0);
  let viewEl: HTMLDivElement | undefined;
  let clipEl: HTMLDivElement | undefined;
  let colsEl: HTMLDivElement | undefined;

  const measure = () => {
    if (!o.active() || !clipEl || !colsEl) return;
    const w = clipEl.clientWidth - GAP;
    if (w <= 0) return;
    setColW(w);
    requestAnimationFrame(() => {
      if (!colsEl) return;
      setPages(Math.max(1, Math.round((colsEl.scrollWidth + GAP) / (w + GAP))));
      setPage((p) => Math.min(p, pages() - 1));
    });
  };

  createEffect(
    on(o.layout, () => {
      if (!o.active()) return;
      // wait for the columns to exist, then count the pages
      queueMicrotask(() =>
        requestAnimationFrame(() => {
          measure();
          requestAnimationFrame(() => {
            if (o.startAtEnd()) setPage(pages() - 1);
          });
        }),
      );
    }),
  );
  createEffect(on(o.section, () => setPage(0), { defer: true }));
  onMount(() => {
    const ro = new ResizeObserver(measure);
    if (clipEl) ro.observe(clipEl);
    void document.fonts?.ready.then(measure);
    onCleanup(() => ro.disconnect());
  });

  const canNext = () => page() < pages() - 1 || !!o.nextSection();
  const canPrev = () => page() > 0 || !!o.prevSection();
  function next() {
    if (page() < pages() - 1) setPage(page() + 1);
    else o.nextSection()?.();
  }
  function prev() {
    if (page() > 0) setPage(page() - 1);
    else o.prevSection()?.();
  }

  // Swipe: in a Hebrew book you turn to the next page from the left edge toward the right.
  let touchX: number | null = null;
  let lastSwipe = 0;
  const swipe = {
    onTouchStart: (e: TouchEvent) => {
      touchX = e.touches[0]?.clientX ?? null;
    },
    onTouchEnd: (e: TouchEvent) => {
      const x = e.changedTouches[0]?.clientX;
      if (touchX === null || x === undefined) return;
      const dx = x - touchX;
      touchX = null;
      if (Math.abs(dx) < 50 || o.blocked()) return;
      if (dx > 0) next();
      else prev();
      lastSwipe = Date.now();
    },
  };
  /** True just after a swipe: the click the browser sends at the end of it should be ignored. */
  const swiped = () => Date.now() - lastSwipe < 350;

  /** Tap the left third of the page for the next page, the right third for the previous one. */
  function tapZone(clientX: number) {
    if (!viewEl) return;
    const r = viewEl.getBoundingClientRect();
    const f = (clientX - r.left) / r.width;
    if (f < 0.33) next();
    else if (f > 0.67) prev();
  }

  return {
    page,
    pages,
    colW,
    shiftY,
    setShiftY,
    next,
    prev,
    canNext,
    canPrev,
    swipe,
    swiped,
    tapZone,
    /** The learner has seen the last page. */
    atEnd: () => colW() > 0 && page() >= pages() - 1,
    /** How far along this section the learner is, 0 to 1. */
    fraction: () => (pages() > 1 ? page() / pages() : 0),
    /** Sideways slide, in pixels, for the current page. */
    offset: () => page() * (colW() + GAP),
    refs: {
      view: (el: HTMLDivElement) => {
        viewEl = el;
      },
      clip: (el: HTMLDivElement) => {
        clipEl = el;
      },
      cols: (el: HTMLDivElement) => {
        colsEl = el;
      },
    },
  };
}
