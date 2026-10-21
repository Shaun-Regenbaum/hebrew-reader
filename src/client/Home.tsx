import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { email } from '../lib/account.ts';
import { authorName } from '../lib/authors.ts';
import {
  allTexts,
  isDone,
  longReads,
  nextUp,
  pathItems,
  STAGE_NAMES,
  type Stage,
  stages,
} from '../lib/path.ts';
import { progress } from '../lib/store.ts';
import { getIndex } from '../lib/texts.ts';
import { Nav } from './Nav.tsx';
import { LevelBars, readingTime, STYLE_LABEL, TextRow } from './TextRow.tsx';

export function Home() {
  const [index] = createResource(getIndex);
  const [explain, setExplain] = createSignal(false);
  const [openStage, setOpenStage] = createSignal<number | null>(null);
  const [showAll, setShowAll] = createSignal<Set<number>>(new Set());

  const items = createMemo(() => (index() ? pathItems(index()!) : []));
  const longs = createMemo(() => (index() ? longReads(index()!) : []));
  const stageList = createMemo(() => stages(items(), progress()));
  const up = createMemo(() => (index() ? nextUp(index()!, progress()) : null));
  const currentStage = createMemo(() => stageList().find((s) => s.done < s.items.length)?.level ?? null);
  const isOpen = (level: number) => (openStage() === null ? currentStage() === level : openStage() === level);
  /** A stage shows its next few unfinished texts; "show all" opens the rest. */
  const STEPS_SHOWN = 5;
  const visibleSteps = (s: Stage) =>
    showAll().has(s.level) ? s.items : s.items.filter((t) => !isDone(t, progress())).slice(0, STEPS_SHOWN);
  const revealAll = (level: number) => setShowAll(new Set([...showAll(), level]));
  const doneCount = createMemo(() => items().filter((t) => isDone(t, progress())).length);
  const easiestUncommon = createMemo(() =>
    items().length ? Math.min(...items().map((t) => t.uncommon)) : 0,
  );

  const topicCounts = createMemo(() => {
    const i = index();
    if (!i) return [];
    const texts = allTexts(i);
    return i.topics
      .map((t) => ({ ...t, n: texts.filter((x) => x.topics.includes(t.key)).length }))
      .filter((t) => t.n > 0)
      .sort((a, b) => b.n - a.n);
  });

  return (
    <>
      <div class="top">
        <div class="serif" style={{ 'font-size': '24px', 'font-weight': '500' }}>
          Read Hebrew
        </div>
        <a
          href="#/account"
          class="signin-link"
          aria-label={email() ? 'Your account' : 'Sign in to keep your words on every device'}
        >
          <Show when={email()} fallback="Sign in">
            <span class="avatar">{(email() ?? '?').slice(0, 1).toUpperCase()}</span>
          </Show>
        </a>
      </div>
      <Show when={index.error}>
        <div class="empty">
          Could not load the texts. Run <code>pnpm texts</code> first.
        </div>
      </Show>

      <section class="hsec">
        <div class="cap" style={{ color: 'var(--accent)' }}>
          {up()?.mode === 'continue' ? 'Continue reading' : up() ? 'Up next' : 'Your path'}
          <Show when={up()}>
            {(u) => (
              <span style={{ color: 'var(--ink3)' }}>
                {u().mode === 'long'
                  ? ' · Long read'
                  : ` · Stage ${u().text.level}, ${STAGE_NAMES[u().text.level - 1]}`}
              </span>
            )}
          </Show>
        </div>
        <Show
          when={up()}
          fallback={
            <Show when={index()}>
              <div class="hnote">You have finished every text. Browse by topic to read again.</div>
            </Show>
          }
        >
          {(u) => {
            const sec = () =>
              u().mode === 'continue' ? (progress()[`${u().text.kind}/${u().text.id}`]?.last ?? 0) : 0;
            return (
              <a class="hero" href={`#/read/${u().text.kind}/${u().text.id}/${sec()}`}>
                <div class="he title">{u().text.title}</div>
                <div class="hauthor">
                  {u().text.kind === 'articles' ? 'Hebrew Wikipedia' : authorName(u().text.author)}
                </div>
                <Show when={u().text.blurb}>
                  <div class="hblurb">{u().text.blurb}</div>
                </Show>
                <div class="tchips" style={{ 'margin-top': '14px' }}>
                  <LevelBars level={u().text.level} />
                  <span>{readingTime(u().text.minutes)}</span>
                  <span>{STYLE_LABEL[u().text.style]}</span>
                </div>
                <span class="btn p" style={{ 'margin-top': '20px', 'align-self': 'flex-start' }}>
                  {u().mode === 'continue' ? 'Keep reading' : 'Start reading'} →
                </span>
              </a>
            );
          }}
        </Show>
      </section>

      <section class="hsec">
        <div class="shead-row">
          <div class="cap">Your path</div>
          <div class="hnote" style={{ margin: 0 }}>
            {doneCount()} of {items().length} texts done
          </div>
        </div>
        <div class="path">
          <For each={stageList()}>
            {(s) => (
              <div
                class="stage"
                classList={{ done: s.done === s.items.length, cur: currentStage() === s.level }}
              >
                <button
                  type="button"
                  class="shead"
                  aria-expanded={isOpen(s.level)}
                  onClick={() => setOpenStage(isOpen(s.level) ? -1 : s.level)}
                >
                  <span class="node">{s.done === s.items.length ? '✓' : s.level}</span>
                  <span class="stext">
                    <b>{s.name}</b>
                    <small>
                      {s.items.length} texts · {readingTime(s.minutes)} of reading
                    </small>
                  </span>
                  <span class="scount">
                    {s.done}/{s.items.length}
                  </span>
                </button>
                <Show when={isOpen(s.level)}>
                  <div class="steps">
                    <For each={visibleSteps(s)}>
                      {(t) => (
                        <TextRow text={t} current={up()?.text.id === t.id && up()?.text.kind === t.kind} />
                      )}
                    </For>
                    <Show when={!showAll().has(s.level) && s.items.length > visibleSteps(s).length}>
                      <button
                        type="button"
                        class="linkbtn"
                        style={{ 'padding-top': '4px' }}
                        onClick={() => revealAll(s.level)}
                      >
                        Show all {s.items.length} texts
                      </button>
                    </Show>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
        <Show when={longs().length}>
          <div class="longnote">
            <div class="cap" style={{ margin: '4px 0 6px' }}>
              Long reads
            </div>
            <div class="hnote">Novels. Read them a section at a time, whenever you like.</div>
            <For each={longs()}>
              {(t) => <TextRow text={t} current={up()?.text.id === t.id && up()?.text.kind === t.kind} />}
            </For>
          </div>
        </Show>
        <button type="button" class="linkbtn" onClick={() => setExplain(!explain())}>
          {explain() ? 'Hide' : 'How are texts rated?'}
        </button>
        <Show when={explain()}>
          <div class="explain">
            <p>
              We compare every word in a text with a list of the most common words in everyday modern Hebrew.
              The more words fall outside the 2,000 most common forms, the higher the level.
            </p>
            <p>
              Old-fashioned writing adds to the level. Biblical-style Hebrew adds the most, then older
              literary Hebrew. Modern Hebrew adds nothing.
            </p>
            <p>
              Levels compare the texts in this library with each other. Even Level 1 is hard for a true
              beginner: about {easiestUncommon()} of every 100 words are outside the 2,000 most common.
            </p>
          </div>
        </Show>
      </section>

      <section class="hsec">
        <div class="cap" style={{ 'margin-bottom': '14px' }}>
          Browse by topic
        </div>
        <div class="topics">
          <For each={topicCounts()}>
            {(t) => (
              <a class="topic" href={`#/topic/${t.key}`}>
                <span>{t.label}</span>
                <small>
                  {t.n} {t.n === 1 ? 'text' : 'texts'}
                </small>
              </a>
            )}
          </For>
        </div>
        <a class="linkbtn" href="#/all">
          All {index() ? allTexts(index()!).length : ''} texts →
        </a>
      </section>
      <div class="pad-nav" />
      <Nav on="read" />
    </>
  );
}
