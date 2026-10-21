import type { LibraryIndex, Para, TextKind, TextMeta } from './types.ts';

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export const getIndex = () => getJson<LibraryIndex>('/texts/index.json');
export const getMeta = (kind: TextKind, id: string) => getJson<TextMeta>(`/texts/${kind}/${id}/meta.json`);
export const getSection = (kind: TextKind, id: string, n: number) => getJson<Para[]>(`/texts/${kind}/${id}/${n}.json`);
