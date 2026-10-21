"""Compare OpenRouter models on the two calls the app makes.

  word      tap a word: meaning in this sentence, dictionary form, root, part of speech
  sentence  translate a sentence into natural English

Reads OPENROUTER_API_KEY from .dev.vars. Needs public/texts (run build_texts.py first).
Run: python3 -I scripts/model_test.py
Writes data/model-test/{items,results}.json and report.md
"""
import collections, concurrent.futures as cf, json, random, re, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEXTS, OUT = ROOT / 'public' / 'texts', ROOT / 'data' / 'model-test'
KEY = dict(l.strip().split('=', 1) for l in open(ROOT / '.dev.vars') if '=' in l)['OPENROUTER_API_KEY']

MODELS = ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4.1-flash', 'qwen/qwen3.8-flash',
          'google/gemini-3.1-flash-lite', 'anthropic/claude-haiku-5.5', 'google/gemini-3.7-flash',
          'deepseek/deepseek-v4-pro', 'anthropic/claude-sonnet-5.5', 'openai/gpt-5.6-terra']
# Books mix literary (Peretz, Mendele, Herzl) with modern (Wikipedia).
SOURCES = [('books', '665'), ('books', '113'), ('books', '1364'), ('books', '6408'), ('books', '7260'),
           ('articles', '1820'), ('articles', '83'), ('articles', '19949'), ('articles', '9108')]

WORD_SYSTEM = (
    'You help a learner read Hebrew. Given a word as it appears in a sentence, reply with ONLY a JSON '
    'object, no other text, with keys: "lemma" (dictionary form, Hebrew, no nikud), "meaning" (short '
    'English meaning of this word in this sentence), "root" (the 3 or 4 letter shoresh in Hebrew, or '
    'null if none), "pos" (noun, verb, adjective, adverb, preposition, conjunction, particle, name), '
    '"binyan" (for verbs only, else null), "say" (transliteration with stress), "note" (one short '
    'sentence about prefixes or form, or null). Separate attached prefixes (ה, ו, ב, ל, מ, ש, כ) from the '
    'word when giving the lemma and meaning.')
SENT_SYSTEM = ('Translate the Hebrew into natural, fluent English. Keep the meaning and tone. '
               'Reply with ONLY the translation, no notes.')


def hebrew_words():
    c = collections.Counter()
    for kind, i in SOURCES:
        meta = json.load(open(TEXTS / kind / i / 'meta.json'))
        for n in range(meta['sections']):
            for p in json.load(open(TEXTS / kind / i / f'{n}.json')):
                c.update(p['t'][a:b] for a, b in p['w'])
    return c


def build_items():
    rnd = random.Random(7)
    freq = hebrew_words()
    common = {w for w, _ in freq.most_common(300)}
    words, sents = [], []
    for kind, i in SOURCES:
        meta = json.load(open(TEXTS / kind / i / 'meta.json'))
        paras = [p for n in range(meta['sections']) for p in json.load(open(TEXTS / kind / i / f'{n}.json')) if not p.get('h')]
        rnd.shuffle(paras)
        got_w = got_s = 0
        for p in paras:
            for s in re.split(r'(?<=[.?!])\s+', p['t']):
                toks = re.findall(r'[א-ת]+', s)
                if not 8 <= len(toks) <= 30:
                    continue
                if got_s < (2 if i == '83' else 1) and 14 <= len(toks) <= 30:
                    sents.append({'text': s, 'source': meta['title']}); got_s += 1; continue
                cand = [t for t in toks if len(t) >= 4 and t not in common and freq[t] <= 3]
                if got_w < 4 and cand:
                    words.append({'word': rnd.choice(cand), 'sentence': s, 'source': meta['title']}); got_w += 1
            if got_w >= 4 and got_s >= (2 if i == '83' else 1):
                break
    return words[:30], sents[:10]


def call(model, system, user):
    body = {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
            'temperature': 0.2, 'usage': {'include': True}, 'reasoning': {'effort': 'low'}, 'max_tokens': 4000}
    last = None
    for attempt in range(3):
        t0 = time.time()
        try:
            req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', json.dumps(body).encode(),
                                         {'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
            d = json.load(urllib.request.urlopen(req, timeout=120))
            u = d.get('usage', {})
            return {'text': (d['choices'][0]['message'].get('content') or '').strip(), 'secs': round(time.time() - t0, 2),
                    'cost': u.get('cost'), 'out_tokens': u.get('completion_tokens')}
        except Exception as e:
            last = str(e)[:200]; time.sleep(2 * (attempt + 1))
    return {'error': last}


def parse_json(t):
    t = re.sub(r'^```(?:json)?\s*|\s*```$', '', t.strip())
    try:
        return json.loads(t[t.index('{'):t.rindex('}') + 1])
    except Exception:
        return None


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    words, sents = build_items()
    json.dump({'words': words, 'sentences': sents}, open(OUT / 'items.json', 'w'), ensure_ascii=False, indent=1)
    jobs = [('word', i, m, WORD_SYSTEM, f"Word: {w['word']}\nSentence: {w['sentence']}\nFrom: {w['source']}")
            for i, w in enumerate(words) for m in MODELS]
    jobs += [('sentence', i, m, SENT_SYSTEM, s['text']) for i, s in enumerate(sents) for m in MODELS]
    res = []
    with cf.ThreadPoolExecutor(8) as ex:
        futs = {ex.submit(call, m, sy, u): (k, i, m) for k, i, m, sy, u in jobs}
        for f in cf.as_completed(futs):
            k, i, m = futs[f]
            r = f.result(); r.update(kind=k, item=i, model=m)
            if k == 'word' and 'text' in r:
                r['parsed'] = parse_json(r['text'])
            res.append(r)
    json.dump(res, open(OUT / 'results.json', 'w'), ensure_ascii=False, indent=1)
    summary(res)


def summary(res):
    print(f"{'model':36} {'ok':>4} {'json%':>6} {'avg s':>6} {'$ total':>8}")
    for m in MODELS:
        r = [x for x in res if x['model'] == m]
        ok = [x for x in r if 'text' in x and x['text']]
        w = [x for x in r if x['kind'] == 'word' and 'text' in x]
        js = sum(1 for x in w if x.get('parsed')) / max(len(w), 1) * 100
        print(f"{m:36} {len(ok):>2}/{len(r):<2} {js:>5.0f}% {sum(x['secs'] for x in ok)/max(len(ok),1):>6.1f} {sum(x.get('cost') or 0 for x in r):>8.4f}")


if __name__ == '__main__':
    main()
