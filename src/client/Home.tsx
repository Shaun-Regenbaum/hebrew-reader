import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { authorName } from '../lib/authors.ts';
import { getIndex } from '../lib/texts.ts';
import { lastPosition } from '../lib/store.ts';
import type { TextKind, TextSummary } from '../lib/types.ts';
import { Nav } from './Nav.tsx';

export function Home() {
  const [index] = createResource(getIndex);
  const [tab, setTab] = createSignal<TextKind>('books');
  const list = createMemo<TextSummary[]>(() => {
    const i = index();
    if (!i) return [];
    return [...i[tab()]].sort((a, b) => a.words - b.words);
  });
  const current = createMemo(() => {
    const i = index();
    if (!i) return null;
    const pos = lastPosition();
    const all = [...i.books, ...i.articles];
    const found = pos ? all.find((t) => t.kind === pos.kind && t.id === pos.id) : undefined;
    if (found && pos) return { text: found, section: pos.section };
    const first = i.books.find((b) => b.title === 'המתיאש') ?? i.books[0];
    return first ? { text: first, section: 0 } : null;
  });

  return (
    <>
      <div class="top">
        <div class="serif" style={{ 'font-size': '24px', 'font-weight': '500' }}>Read Hebrew</div>
      </div>
      <Show when={current()}>
        {(c) => (
          <a class="hero" href={`#/read/${c().text.kind}/${c().text.id}/${c().section}`}>
            <div class="cap" style={{ color: 'var(--accent)' }}>{lastPosition() ? 'Continue reading' : 'Start here'}</div>
            <div class="he title">{c().text.title}</div>
            <div class="row">
              <span>{authorName(c().text.author)}</span>
              <span>{lastPosition() ? `Section ${c().section + 1} of ${c().text.sections}` : `${c().text.words.toLocaleString()} words`}</span>
            </div>
            <div class="bar"><i style={{ width: `${(c().section / c().text.sections) * 100}%` }} /></div>
          </a>
        )}
      </Show>
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected={tab() === 'books'} classList={{ on: tab() === 'books' }} onClick={() => setTab('books')}>Books</button>
        <button role="tab" aria-selected={tab() === 'articles'} classList={{ on: tab() === 'articles' }} onClick={() => setTab('articles')}>Articles</button>
      </div>
      <Show when={index.error}><div class="empty">Could not load the texts. Run <code>pnpm texts</code> first.</div></Show>
      <For each={list()}>
        {(t) => (
          <a class="book" href={`#/read/${t.kind}/${t.id}/0`}>
            <div>
              <div class="a">{authorName(t.author)}</div>
              <div class="m">{t.words.toLocaleString()} words</div>
            </div>
            <div class="he">{t.title}</div>
          </a>
        )}
      </For>
      <div class="pad-nav" />
      <Nav on="read" />
    </>
  );
}
