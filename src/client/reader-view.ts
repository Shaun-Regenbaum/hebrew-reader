export type View = 'scroll' | 'page';

/** Type sizes by view, in pixels. The page view is a book page with small type; the scroll view is large and zoomed in. */
export const SIZES: Record<View, number[]> = { scroll: [21, 24, 27, 30], page: [14, 16, 18, 20] };

/** Room the open sheet takes at the bottom of the screen, so the tapped word can be kept above it. */
export const SHEET_ROOM = 300;
