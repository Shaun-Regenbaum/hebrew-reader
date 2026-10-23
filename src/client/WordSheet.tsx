import { createEffect, createResource, createSignal, Show } from 'solid-js';
import { flags, setFlag } from '../lib/habit.ts';
import { normalizeWord } from '../lib/sentence.ts';
import { saveLookup, seenWords } from '../lib/store.ts';
import type { Lookup, TextKind } from '../lib/types.ts';

export interface SheetState {
  id: string;
  word: string;
  p: number;
  sentence: { start: number; end: number; text: string };
  /** The whole paragraph, so the model can read the sentence in context. */
  context: string;
  /** The words of the sentence in order, and their positions in the paragraph. */
  words: string[];
  wis: number[];
}

export interface SheetText {
  kind: TextKind;
  id: string;
  title: string;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(j.error ?? `Request failed (${res.status})`);
  return j;
}

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

export function WordSheet(props: {
  sheet: SheetState;
  text: SheetText;
  onRange: (r: { p: number; start: number; end: number } | null) => void;
  /** English words to show above the sentence's Hebrew words; null clears them. */
  onGloss: (g: { p: number; wis: number[]; glosses: string[] } | null) => void;
  onClose: () => void;
}) {
  const [attempt, setAttempt] = createSignal(0);
  const [view, setView] = createSignal<'word' | 'sentence'>('word');
  const [tr, setTr] = createSignal<{
    state: 'loading' | 'done' | 'error';
    text: string;
    glosses?: string[] | null;
  }>({ state: 'loading', text: '' });
  // Start translating the sentence right away, so it is usually ready by the time the learner asks.
  const startTranslation = () =>
    post<{ translation: string; glosses: string[] | null }>('/api/translate', {
      text: props.sheet.sentence.text,
      context: props.sheet.context,
      words: props.sheet.words,
      title: props.text.title,
    }).then(
      (r) => setTr({ state: 'done', text: r.translation, glosses: r.glosses }),
      (e) => setTr({ state: 'error', text: e instanceof Error ? e.message : 'Translation failed' }),
    );
  void startTranslation();

  // Is this the first time this reader looks the word up? The server counts only those, anonymously.
  const firstTime = !seenWords().has(normalizeWord(props.sheet.word));
  const [lookup] = createResource(
    () => attempt(),
    async () =>
      (
        await post<{ lookup: Lookup }>('/api/lookup', {
          word: props.sheet.word,
          sentence: props.sheet.sentence.text,
          context: props.sheet.context,
          title: props.text.title,
          first: firstTime,
          textKey: `${props.text.kind}/${props.text.id}`,
        })
      ).lookup,
  );

  createEffect(() => {
    const l = lookup();
    if (!l) return;
    saveLookup({
      ...l,
      id: props.sheet.id,
      word: props.sheet.word,
      sentence: props.sheet.sentence.text,
      textId: props.text.id,
      textKind: props.text.kind,
      textTitle: props.text.title,
      at: Date.now(),
    });
  });

  // Show the English words above the sentence once it is translated; take them away when it is not.
  createEffect(() => {
    const t = tr();
    if (view() === 'sentence' && t.state === 'done' && t.glosses) {
      props.onGloss({ p: props.sheet.p, wis: props.sheet.wis, glosses: t.glosses });
    } else props.onGloss(null);
  });

  async function translate() {
    setFlag('translated');
    setView('sentence');
    props.onRange({ p: props.sheet.p, start: props.sheet.sentence.start, end: props.sheet.sentence.end });
    if (tr().state === 'error') {
      setTr({ state: 'loading', text: '' });
      await startTranslation();
    }
  }

  function backToWord() {
    setView('word');
    props.onRange(null);
  }

  return (
    <div class="sheet" role="dialog" aria-label="Word meaning">
      <button type="button" class="sr" onClick={props.onClose}>
        Close
      </button>
      <Show when={view() === 'word'}>
        <Show
          when={!lookup.error}
          fallback={
            <>
              <div class="he hw">{props.sheet.word}</div>
              <div class="err">{(lookup.error as Error).message}</div>
              <div class="acts">
                <button type="button" class="btn p" onClick={() => setAttempt((a) => a + 1)}>
                  Try again
                </button>
              </div>
            </>
          }
        >
          <Show
            when={lookup()}
            fallback={
              <>
                <div class="he hw">{props.sheet.word}</div>
                <div class="skel" style={{ width: '60%' }} />
                <div class="skel" style={{ width: '85%' }} />
                <div class="skel" style={{ width: '40%' }} />
              </>
            }
          >
            {(l) => (
              <>
                <div
                  style={{
                    display: 'flex',
                    'justify-content': 'space-between',
                    'align-items': 'flex-start',
                    gap: '12px',
                  }}
                >
                  <div style={{ 'min-width': 0 }}>
                    <div class="cap">
                      {l().pos}
                      {l().binyan ? ` · ${l().binyan}` : ''}
                      <Show when={l().root}>
                        {' · root '}
                        <span
                          class="he"
                          style={{ 'letter-spacing': 0, 'font-size': '14px', 'font-weight': 500 }}
                        >
                          {l().root}
                        </span>
                      </Show>
                    </div>
                    <div class="serif big">{l().meaning}</div>
                  </div>
                  <div style={{ 'text-align': 'right', 'flex-shrink': 0 }}>
                    <div class="he hw">{l().lemma}</div>
                    <div
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'flex-end',
                        gap: '8px',
                        'margin-top': '6px',
                      }}
                    >
                      <span style={{ 'font-size': '13px', color: 'var(--ink3)' }}>{l().say}</span>
                      <button
                        type="button"
                        class="sp"
                        aria-label="Hear it"
                        onClick={() => speak(props.sheet.word)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 9v6h4l5 4V5L8 9H4z" />
                          <path d="M16.5 8.5a5 5 0 010 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <Show when={l().note}>
                  <div class="sub">{l().note}</div>
                </Show>
                <Show when={!flags().translated}>
                  <div class="coach">Now tap Translate sentence to see the whole line.</div>
                </Show>
                <div class="acts">
                  <button type="button" class="btn" onClick={translate}>
                    Translate sentence →
                  </button>
                  <span class="spacer" />
                  <span class="saved">✓ Added to your words</span>
                </div>
              </>
            )}
          </Show>
        </Show>
      </Show>
      <Show when={view() === 'sentence'}>
        <div class="cap">Translation</div>
        <Show
          when={tr().state !== 'loading'}
          fallback={
            <>
              <div class="skel" style={{ width: '90%' }} />
              <div class="skel" style={{ width: '70%' }} />
            </>
          }
        >
          <div
            classList={{ serif: tr().state === 'done', err: tr().state === 'error' }}
            style={
              tr().state === 'done'
                ? { 'font-size': '24px', 'line-height': 1.35, 'margin-top': '10px' }
                : undefined
            }
          >
            {tr().text}
          </div>
        </Show>
        <div class="acts">
          <button type="button" class="btn" onClick={backToWord}>
            ← Back to word
          </button>
          <Show when={tr().state === 'error'}>
            <button type="button" class="btn p" onClick={translate}>
              Try again
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
