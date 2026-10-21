import { Nav } from './Nav.tsx';

/** Stub. Flashcards (FSRS) are the next piece; lookups are already being saved for them. */
export function Review() {
  return (
    <>
      <div class="top"><div class="serif" style={{ 'font-size': '28px', 'font-weight': '500' }}>Review</div></div>
      <div class="empty">
        <div class="serif">Flashcards are coming next</div>
        Every word you look up is already saved. They will turn into cards here.
      </div>
      <Nav on="review" />
    </>
  );
}
