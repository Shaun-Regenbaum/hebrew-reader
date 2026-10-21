"""Tag every text with topics and a one-line description, using the model on the text's real opening.

Run: python3 -I scripts/tag_topics.py     (needs OPENROUTER_API_KEY in .dev.vars, and public/texts)
Writes data/meta/topics.json, keyed "kind/id". Review it by eye: it is committed.
Skips texts already in the file; delete an entry to redo it.
"""
import concurrent.futures as cf, json, re, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEXTS, OUT = ROOT / 'public' / 'texts', ROOT / 'data' / 'meta' / 'topics.json'
KEY = dict(l.strip().split('=', 1) for l in open(ROOT / '.dev.vars') if '=' in l)['OPENROUTER_API_KEY']
MODEL = 'google/gemini-3.7-flash'

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from taxonomy import TOPICS

SYSTEM = (
    'You help organize a library for people learning Hebrew. You get a text title, author, and its opening. '
    'Reply with ONLY a JSON object: {"topics": [...], "blurb": "..."}. '
    '"topics": the key from this list that best fits what the text is about. Give a second key only if the text is clearly about both, for example a biography of a scientist. Most texts need just one: '
    + ', '.join(f'{k} ({v})' for k, v in TOPICS.items())
    + '. "blurb": one plain English sentence of at most 22 words saying what the text is about or what happens in it. '
    'Do not invent details that are not in the opening or obvious from the title.'
)


def opening(kind, id_, n=900):
    meta = json.load(open(TEXTS / kind / id_ / 'meta.json'))
    paras = json.load(open(TEXTS / kind / id_ / '0.json'))
    words = []
    for p in paras:
        words += p['t'].split()
        if len(words) >= n:
            break
    return meta, ' '.join(words[:n])


def ask(kind, id_):
    meta, text = opening(kind, id_)
    user = f"Title: {meta['title']}\nAuthor: {meta.get('author') or 'Hebrew Wikipedia'}\nKind: {'article' if kind == 'articles' else 'book or story'}\nOpening:\n{text}"
    body = {'model': MODEL, 'temperature': 0.2, 'reasoning': {'effort': 'low'},
            'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}]}
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', json.dumps(body).encode(),
                                 {'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
    raw = json.load(urllib.request.urlopen(req, timeout=120))['choices'][0]['message']['content']
    o = json.loads(re.search(r'\{.*\}', raw, re.S).group(0))
    topics = [t for t in o['topics'] if t in TOPICS][:2]
    assert topics and o['blurb'].strip(), raw
    return {'topics': topics, 'blurb': o['blurb'].strip()}


def main():
    done = json.loads(OUT.read_text()) if OUT.exists() else {}
    idx = json.load(open(TEXTS / 'index.json'))
    todo = [(k, t['id']) for k in ('books', 'articles') for t in idx[k] if f'{k}/{t["id"]}' not in done]
    with cf.ThreadPoolExecutor(6) as ex:
        futs = {ex.submit(ask, k, i): (k, i) for k, i in todo}
        for f in cf.as_completed(futs):
            k, i = futs[f]
            try:
                done[f'{k}/{i}'] = f.result()
            except Exception as e:
                print('FAILED', k, i, str(e)[:120])
    OUT.write_text(json.dumps(done, ensure_ascii=False, indent=1))
    titles = {f'{k}/{t["id"]}': t['title'] for k in ('books', 'articles') for t in idx[k]}
    for key, v in sorted(done.items()):
        print(f"{key:16} {titles.get(key, '?')[:24]:24} {','.join(v['topics']):26} {v['blurb']}")


if __name__ == '__main__':
    main()
