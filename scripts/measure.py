"""Measure how hard each text is, from word frequency.

Reads public/texts and data/freq/he_50k.txt (modern spoken Hebrew, OpenSubtitles, CC BY-SA 4.0,
from github.com/hermitdave/FrequencyWords). A word's rank is its place in that list: 1 is the
most common. Run: python3 -I scripts/measure.py            (prints a table)
Imported by build_texts.py for the numbers it stores.
"""
import json, re, statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEXTS, FREQ = ROOT / 'public' / 'texts', ROOT / 'data' / 'freq' / 'he_50k.txt'
GRID = [500, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 12000, 20000, 50000]
PREFIX = set('ובהלמשכ')

# Forms that mark Biblical-style narrative ("and he said", "and it was"). Crude, and only a signal.
BIBLICAL_FORMS = set('''ויאמר ויהי ויבא ויען ויקח וישב ויקם וילך וירא ויצא ויקרא ויעש וישלח וידבר וישא ויתן וישם ותאמר ותהי
ותבא ותלך ותקח וייקץ ויקרב ויחר ויעל וירד וידע ויעמד ויבך וישמע ויסף ותען ותרא ותשב ותקם ותצא ויברך ויפל ויאהב ויבחר
ויעבור וימת ויכן ויהיו ויבאו ויאמרו ויעשו וילכו וישבו ויקומו ויקחו ויענו ויצאו וישאו ויפלו'''.split())
STYLE_COST = {'modern': 0, 'literary': 5, 'biblical': 10}
# Level cut-offs on the difficulty score (see score()). Relative to this library, not to Hebrew as a whole.
LEVEL_CUTS = [48, 52, 56, 60]
WORDS_PER_MINUTE = 60  # a learner reading with lookups

_rank = None


def ranks():
    global _rank
    if _rank is None:
        _rank = {}
        for i, line in enumerate(FREQ.read_text(encoding='utf-8').splitlines(), 1):
            w = line.split(' ')[0]
            _rank.setdefault(w, i)
    return _rank


def word_rank(w):
    """Rank of a word, counting a word with attached prefixes as easy as its base."""
    r = ranks()
    best = r.get(w)
    for n in (1, 2, 3):
        if len(w) - n >= 2 and all(c in PREFIX for c in w[:n]):
            b = r.get(w[n:])
            if b is not None and (best is None or b < best):
                best = b
    return best


def measure(words, sentences):
    """words: list of word strings; sentences: count. Returns the numbers we store."""
    rs = [word_rank(w) for w in words if re.search('[א-ת]', w)]
    n = len(rs)
    known = sorted(x for x in rs if x is not None)
    cov = lambda k: sum(1 for x in rs if x is not None and x <= k) / n
    vocab95 = next((k for k in GRID if cov(k) >= 0.95), None)
    return {
        'tokens': n,
        'cov1k': round(cov(1000), 3), 'cov2k': round(cov(2000), 3), 'cov5k': round(cov(5000), 3),
        'unknown': round(sum(1 for x in rs if x is None) / n, 3),
        'vocab95': vocab95,
        'medianRank': int(statistics.median(known)) if known else None,
        'sentenceLen': round(n / max(sentences, 1), 1),
    }


def style_of(kind, words):
    """modern (Wikipedia), biblical (heavy on narrative vav-forms), or literary (other old Hebrew)."""
    if kind == 'articles':
        return 'modern'
    rate = sum(1 for w in words if w in BIBLICAL_FORMS) / max(len(words), 1) * 1000
    return 'biblical' if rate >= 10 else 'literary'


def score(m, style):
    """Difficulty score: percent of words outside the 2,000 most common forms, plus a cost for old-fashioned style."""
    return round((1 - m['cov2k']) * 100) + STYLE_COST[style]


def level_of(sc):
    return 1 + sum(1 for c in LEVEL_CUTS if sc > c)


def text_words(kind, id_):
    meta = json.load(open(TEXTS / kind / id_ / 'meta.json'))
    words, sents = [], 0
    for i in range(meta['sections']):
        for p in json.load(open(TEXTS / kind / id_ / f'{i}.json')):
            if p.get('h'):
                continue
            words += [p['t'][a:b] for a, b in p['w']]
            sents += max(1, len(re.findall(r'[.?!](?=\s|$)', p['t'])))
    return meta, words, sents


if __name__ == '__main__':
    idx = json.load(open(TEXTS / 'index.json'))
    rows = []
    for kind in ('books', 'articles'):
        for t in idx[kind]:
            meta, words, sents = text_words(kind, t['id'])
            rows.append((kind, t['title'], measure(words, sents)))
    rows.sort(key=lambda r: (r[2]['vocab95'] or 10**9, -r[2]['cov2k']))
    print(f"{'kind':8} {'title':26} {'words':>6} {'<=1k':>5} {'<=2k':>5} {'<=5k':>5} {'unk':>5} {'v95':>6} {'medR':>5} {'sLen':>5}")
    for k, title, m in rows:
        print(f"{k:8} {title[:26]:26} {m['tokens']:>6} {m['cov1k']*100:>4.0f}% {m['cov2k']*100:>4.0f}% {m['cov5k']*100:>4.0f}% {m['unknown']*100:>4.0f}% {str(m['vocab95']):>6} {m['medianRank']:>5} {m['sentenceLen']:>5}")
