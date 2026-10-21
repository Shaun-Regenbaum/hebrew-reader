/** The sentence containing a character offset, split on . ? ! followed by a space. */
export function sentenceAt(text: string, offset: number): { start: number; end: number; text: string } {
  let start = 0;
  let end = text.length;
  const stop = /[.?!]["”']?(?=\s|$)/g;
  let m: RegExpExecArray | null = stop.exec(text);
  while (m) {
    const after = m.index + m[0].length;
    if (after <= offset) start = after;
    else {
      end = after;
      break;
    }
    m = stop.exec(text);
  }
  while (start < end && /\s/.test(text[start] ?? '')) start++;
  return { start, end, text: text.slice(start, end) };
}

/** Hebrew letters only: the form we compare words by (no nikud, no punctuation). */
export function normalizeWord(w: string): string {
  return w.replace(/[֑-ׇ]/g, '');
}
