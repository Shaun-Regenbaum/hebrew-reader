import { createMemo, createSignal, For, Show } from 'solid-js';
import { known, lookups, toggleKnown } from '../lib/store.ts';
import { Nav } from './Nav.tsx';

interface Row {
  lemma: string;
  meaning: string;
  count: number;
  titles: string[];
}

export function Words() {
  const [tab, setTab] = createSignal<'top' | 'book' | 'known'>('top');

  const rows = createMemo<Row[]>(() => {
    const by = new Map<string, Row>();
    for (const l of lookups()) {
      const r = by.get(l.lemma);
      if (r) {
        r.count++;
        if (!r.titles.includes(l.textTitle)) r.titles.push(l.textTitle);
      } else by.set(l.lemma, { lemma: l.lemma, meaning: l.meaning, count: 1, titles: [l.textTitle] });
    }
    return [...by.values()].sort((a, b) => b.count - a.count);
  });
  const isKnown = (lemma: string) => known().includes(lemma);
  const shown = createMemo(() => (tab() === 'known' ? rows().filter((r) => isKnown(r.lemma)) : rows().filter((r) => !isKnown(r.lemma))));
  const max = createMemo(() => Math.max(1, ...rows().map((r) => r.count)));
  const groups = createMemo(() => {
    const g = new Map<string, Row[]>();
    for (const r of shown()) for (const t of r.titles) g.set(t, [...(g.get(t) ?? []), r]);
    return [...g.entries()];
  });

  const RowView = (r: Row) => (
    <div class="wrow">
      <div class="he">{r.lemma}</div>
      <div>
        <div class="e">{r.meaning}</div>
        <div class="bar" style={{ 'margin-top': '9px', height: '5px' }}>
          <i style={{ width: `${(r.count / max()) * 100}%` }} />
        </div>
        <div class="s">{r.count === 1 ? 'Looked up once' : `Looked up ${r.count} times`}</div>
      </div>
      <button class="chk" classList={{ on: isKnown(r.lemma) }} aria-label={isKnown(r.lemma) ? 'Mark as not known' : 'Mark as known'} aria-pressed={isKnown(r.lemma)} onClick={() => toggleKnown(r.lemma)}>
        <Show when={isKnown(r.lemma)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
        </Show>
      </button>
    </div>
  );

  return (
    <>
      <div class="top">
        <div class="serif" style={{ 'font-size': '28px', 'font-weight': '500' }}>My words</div>
        <div class="cap">{rows().length} {rows().length === 1 ? 'word' : 'words'}</div>
      </div>
      <div class="tabs" style={{ 'margin-top': '22px' }}>
        <button classList={{ on: tab() === 'top' }} onClick={() => setTab('top')}>Most looked up</button>
        <button classList={{ on: tab() === 'book' }} onClick={() => setTab('book')}>By book</button>
        <button classList={{ on: tab() === 'known' }} onClick={() => setTab('known')}>Known</button>
      </div>
      <Show when={rows().length > 0} fallback={<div class="empty"><div class="serif">Nothing here yet</div>Tap a word while you read. It will show up here.</div>}>
        <Show when={tab() !== 'book'} fallback={<For each={groups()}>{([title, rs]) => (<><div class="group cap he" style={{ 'text-align': 'left' }}>{title}</div><For each={rs}>{RowView}</For></>)}</For>}>
          <For each={shown()}>{RowView}</For>
        </Show>
      </Show>
      <div class="pad-nav" />
      <Nav on="words" />
    </>
  );
}
