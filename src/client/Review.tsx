import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
  ANSWERS,
  type Answer,
  answer,
  buildQueue,
  isLearned,
  nextDue,
  previews,
  type ReviewItem,
  SAME_SITTING_MS,
  wait,
} from '../lib/review.ts';
import { cards, known, lookups, saveCard, toggleKnown } from '../lib/store.ts';
import { Nav } from './Nav.tsx';

const LABEL: Record<Answer, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };

function speak(word: string) {
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'he-IL';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* no speech support */
  }
}

/** The sentence the learner met the word in, with that word marked. */
function Sentence(props: { sentence: string; word: string }) {
  const at = () => props.sentence.indexOf(props.word);
  return (
    <p class="he rvsent" lang="he" dir="rtl">
      <Show when={at() >= 0} fallback={props.sentence}>
        {props.sentence.slice(0, at())}
        <mark>{props.word}</mark>
        {props.sentence.slice(at() + props.word.length)}
      </Show>
    </p>
  );
}

/** Flashcards: the sentence you met a word in, then its meaning, then how well you knew it. */
export function Review() {
  const queue = createMemo(() => buildQueue(lookups(), known(), cards()));
  const [session, setSession] = createSignal<ReviewItem[] | null>(null);
  const [pos, setPos] = createSignal(0);
  const [shown, setShown] = createSignal(false);
  const [missed, setMissed] = createSignal(0);
  const [answered, setAnswered] = createSignal(0);

  const current = () => session()?.[pos()];
  const finished = () => !!session() && pos() >= (session()?.length ?? 0);
  const minutes = (n: number) => Math.max(1, Math.round(n / 3));
  const learned = createMemo(() => Object.values(cards()).filter(isLearned).length);
  const saved = createMemo(() => new Set(lookups().map((l) => l.lemma)).size);

  function start() {
    setSession([...queue().items]);
    setPos(0);
    setShown(false);
    setMissed(0);
    setAnswered(0);
  }

  function grade(how: Answer) {
    const item = current();
    if (!item || !shown()) return;
    const now = new Date();
    const next = answer(item.card, how, now);
    saveCard(item.lemma, next);
    setAnswered(answered() + 1);
    if (how === 'again') setMissed(missed() + 1);
    // a card that comes back within minutes is asked again before we finish
    if (next.d - now.getTime() < SAME_SITTING_MS) {
      setSession([...(session() ?? []), { ...item, card: next }]);
    }
    setPos(pos() + 1);
    setShown(false);
  }

  function skipKnown() {
    const item = current();
    if (!item) return;
    toggleKnown(item.lemma);
    setPos(pos() + 1);
    setShown(false);
  }

  const onKey = (e: KeyboardEvent) => {
    if (!session() || finished()) return;
    if (!shown() && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      setShown(true);
    } else if (shown() && e.key >= '1' && e.key <= '4') {
      grade(ANSWERS[Number(e.key) - 1] as Answer);
    }
  };
  onMount(() => document.addEventListener('keydown', onKey));
  onCleanup(() => document.removeEventListener('keydown', onKey));

  const soon = () => {
    const t = nextDue(cards(), known());
    return t === null ? null : wait(Math.max(0, t - Date.now()));
  };

  return (
    <Show
      when={session()}
      fallback={
        <>
          <div class="top">
            <div class="serif" style={{ 'font-size': '28px', 'font-weight': '500' }}>
              Review
            </div>
          </div>
          <div class="tpage">
            <Show
              when={lookups().length > 0}
              fallback={
                <div class="rvempty">
                  <div class="serif mh">No words yet</div>
                  <p class="msub">Tap a word while you read. It turns into a flashcard here.</p>
                  <a class="btn p wide" href="#/">
                    Go and read
                  </a>
                </div>
              }
            >
              <Show
                when={queue().items.length > 0}
                fallback={
                  <div class="rvempty">
                    <div class="serif mh">You are caught up</div>
                    <p class="msub">
                      <Show when={soon()} fallback="Look up more words while you read.">
                        {(s) => <>The next card is due in {s()}.</>}
                      </Show>
                      <Show when={queue().waiting > 0}>
                        {' '}
                        {queue().waiting} more new {queue().waiting === 1 ? 'word waits' : 'words wait'} for
                        tomorrow.
                      </Show>
                    </p>
                    <a class="btn wide" href="#/">
                      Back to Today
                    </a>
                  </div>
                }
              >
                <div class="tblock">
                  <h2 class="serif mh">
                    {queue().items.length} {queue().items.length === 1 ? 'card' : 'cards'} to review
                  </h2>
                  <p class="msub" style={{ margin: '6px 0 0' }}>
                    {queue().due.length} due, {queue().fresh.length} new. About{' '}
                    {minutes(queue().items.length)} min.
                  </p>
                </div>
                <button type="button" class="btn p wide" onClick={start}>
                  Start
                </button>
              </Show>
              <div class="stats">
                <div>
                  <b class="serif">{saved()}</b>
                  <span>{saved() === 1 ? 'word saved' : 'words saved'}</span>
                </div>
                <div>
                  <b class="serif">{learned()}</b>
                  <span>learned</span>
                </div>
              </div>
            </Show>
          </div>
          <div class="pad-nav" />
          <Nav on="review" />
        </>
      }
    >
      <div class="rv">
        <div class="rvtop">
          <button type="button" class="iconbtn" aria-label="Stop reviewing" onClick={() => setSession(null)}>
            <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div class="goalbar" style={{ flex: 1, margin: 0 }}>
            <i
              style={{
                width: `${(Math.min(pos(), session()?.length ?? 1) / (session()?.length ?? 1)) * 100}%`,
              }}
            />
          </div>
          <span class="rvn">
            {Math.min(pos() + 1, session()?.length ?? 0)} / {session()?.length}
          </span>
        </div>

        <Show
          when={!finished()}
          fallback={
            <div class="rvdone">
              <div class="inscr he" lang="he">
                כל הכבוד
              </div>
              <h1 class="serif dh">Review done</h1>
              <p class="msub">
                {answered()} {answered() === 1 ? 'card' : 'cards'}.{' '}
                {missed() > 0 ? `${missed()} need another look soon.` : 'You knew them all.'}
              </p>
              <div class="doneacts">
                <a class="btn p wide" href="#/">
                  Back to Today
                </a>
                <Show when={queue().items.length > 0}>
                  <button type="button" class="btn wide" onClick={start}>
                    Keep going
                  </button>
                </Show>
              </div>
            </div>
          }
        >
          <Show when={current()} keyed>
            {(item) => (
              <div class="rvbody">
                <div class="rvcard">
                  <div class="cap">{shown() ? 'Meaning' : 'What does this word mean?'}</div>
                  <Sentence sentence={item.lookup.sentence} word={item.lookup.word} />
                  <Show when={shown()}>
                    <div class="rvans">
                      <div class="rvrow">
                        <div>
                          <div class="cap">
                            {item.lookup.pos}
                            {item.lookup.binyan ? ` · ${item.lookup.binyan}` : ''}
                            {item.lookup.root ? ` · root ${item.lookup.root}` : ''}
                          </div>
                          <div class="serif big rvmean">{item.lookup.meaning}</div>
                        </div>
                        <div class="rvlem">
                          <div class="he hw">{item.lookup.lemma}</div>
                          <div class="rvsay">
                            <span>{item.lookup.say}</span>
                            <button
                              type="button"
                              class="sp"
                              aria-label="Hear it"
                              onClick={() => speak(item.lookup.word)}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M4 9v6h4l5 4V5L8 9H4z" />
                                <path d="M16.5 8.5a5 5 0 010 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      <Show when={item.lookup.note}>
                        <div class="sub" style={{ 'margin-top': '10px' }}>
                          {item.lookup.note}
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
                <div class="rvfoot">
                  <Show
                    when={shown()}
                    fallback={
                      <button type="button" class="btn p wide" onClick={() => setShown(true)}>
                        Show meaning
                      </button>
                    }
                  >
                    <div class="grades">
                      <For each={ANSWERS}>
                        {(how) => (
                          <button
                            type="button"
                            class="grade"
                            classList={{ good: how === 'good' }}
                            onClick={() => grade(how)}
                          >
                            <b>{LABEL[how]}</b>
                            <span>{previews(item.card)[how]}</span>
                          </button>
                        )}
                      </For>
                    </div>
                    <button type="button" class="linkbtn" onClick={skipKnown}>
                      I already know this word
                    </button>
                  </Show>
                </div>
              </div>
            )}
          </Show>
        </Show>
      </div>
    </Show>
  );
}
