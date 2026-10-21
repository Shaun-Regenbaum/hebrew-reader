import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { allTexts } from '../lib/path.ts';
import { getIndex } from '../lib/texts.ts';
import { Nav } from './Nav.tsx';
import { TextRow } from './TextRow.tsx';

type Kind = 'all' | 'books' | 'articles';

/** Every text, filtered by topic and kind, easiest first. */
export function Browse(props: { topic: string | null }) {
  const [index] = createResource(getIndex);
  const [kind, setKind] = createSignal<Kind>('all');
  const [short, setShort] = createSignal(false);
  const topic = () => props.topic;

  const list = createMemo(() => {
    const i = index();
    if (!i) return [];
    return allTexts(i)
      .filter((t) => (topic() ? t.topics.includes(topic() as string) : true))
      .filter((t) => (kind() === 'all' ? true : t.kind === kind()))
      .sort((a, b) => (short() ? a.minutes - b.minutes : a.level - b.level || a.minutes - b.minutes));
  });
  const title = () => index()?.topics.find((t) => t.key === topic())?.label ?? 'All texts';

  return (
    <>
      <div class="top">
        <a class="iconbtn" href="#/">
          <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span class="sr">Back to home</span>
        </a>
        <div class="serif" style={{ 'font-size': '24px', 'font-weight': '500' }}>
          {title()}
        </div>
        <div style={{ width: '22px' }} />
      </div>
      <div class="chiprow" role="tablist" aria-label="Topic">
        <a class="chip" classList={{ on: !topic() }} href="#/all">
          All
        </a>
        <For each={index()?.topics ?? []}>
          {(t) => (
            <a class="chip" classList={{ on: topic() === t.key }} href={`#/topic/${t.key}`}>
              {t.label}
            </a>
          )}
        </For>
      </div>
      <div class="tabs" style={{ 'margin-top': '6px' }}>
        <button type="button" classList={{ on: kind() === 'all' }} onClick={() => setKind('all')}>
          All
        </button>
        <button type="button" classList={{ on: kind() === 'books' }} onClick={() => setKind('books')}>
          Books
        </button>
        <button type="button" classList={{ on: kind() === 'articles' }} onClick={() => setKind('articles')}>
          Articles
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          classList={{ on: short() }}
          onClick={() => setShort(!short())}
          aria-pressed={short()}
        >
          Shortest first
        </button>
      </div>
      <Show
        when={list().length}
        fallback={
          <div class="empty">
            <div class="serif">Nothing here</div>No {kind() === 'all' ? 'texts' : kind()} on this topic yet.
          </div>
        }
      >
        <div class="steps flat">
          <For each={list()}>{(t) => <TextRow text={t} />}</For>
        </div>
      </Show>
      <div class="pad-nav" />
      <Nav on="read" />
    </>
  );
}
