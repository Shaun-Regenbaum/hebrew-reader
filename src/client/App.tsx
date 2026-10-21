import { createMemo, createSignal, Match, onCleanup, Switch } from 'solid-js';
import type { TextKind } from '../lib/types.ts';
import { Browse } from './Browse.tsx';
import { Home } from './Home.tsx';
import { Reader } from './Reader.tsx';
import { Review } from './Review.tsx';
import { Words } from './Words.tsx';

type Route =
  | { name: 'home' }
  | { name: 'words' }
  | { name: 'browse'; topic: string | null }
  | { name: 'review' }
  | { name: 'read'; kind: TextKind; id: string; section: number; end: boolean };

function parse(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/');
  if (p[0] === 'read' && (p[1] === 'books' || p[1] === 'articles') && p[2]) {
    return {
      name: 'read',
      kind: p[1],
      id: p[2],
      section: Math.max(0, Number(p[3]) || 0),
      end: p[4] === 'end',
    };
  }
  if (p[0] === 'words') return { name: 'words' };
  if (p[0] === 'all') return { name: 'browse', topic: null };
  if (p[0] === 'topic' && p[1]) return { name: 'browse', topic: p[1] };
  if (p[0] === 'review') return { name: 'review' };
  return { name: 'home' };
}

export function App() {
  const [route, setRoute] = createSignal<Route>(parse(location.hash));
  const onHash = () => {
    setRoute(parse(location.hash));
    window.scrollTo(0, 0);
  };
  const browseRoute = createMemo(() => {
    const r = route();
    return r.name === 'browse' ? r : undefined;
  });
  const readRoute = createMemo(() => {
    const r = route();
    return r.name === 'read' ? r : undefined;
  });
  window.addEventListener('hashchange', onHash);
  onCleanup(() => window.removeEventListener('hashchange', onHash));

  return (
    <div class="app">
      <Switch>
        <Match when={route().name === 'home'}>
          <Home />
        </Match>
        <Match when={browseRoute()}>{(r) => <Browse topic={r().topic} />}</Match>
        <Match when={route().name === 'words'}>
          <Words />
        </Match>
        <Match when={route().name === 'review'}>
          <Review />
        </Match>
        <Match when={readRoute()}>
          {(r) => <Reader kind={r().kind} id={r().id} section={r().section} end={r().end} />}
        </Match>
      </Switch>
    </div>
  );
}
