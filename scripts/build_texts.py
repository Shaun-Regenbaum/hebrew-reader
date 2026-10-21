"""Turn data/raw into the JSON the reader loads, in public/texts.

Run: python3 -I scripts/build_texts.py

Output:
  public/texts/index.json            the two shelves (books, articles)
  public/texts/<kind>/<id>/meta.json title, author, credit, section list
  public/texts/<kind>/<id>/<n>.json  one section: paragraphs with word offsets
"""
import csv, json, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import measure as M
RAW, OUT = ROOT / 'data' / 'raw', ROOT / 'public' / 'texts'
SECTION_WORDS = 1200

# Hebrew marks: cantillation and nikud, except the maqaf (U+05BE), which joins words.
MARKS = re.compile('[֑-ֽֿׁ-ׇ]')
WORD = re.compile(r'[א-ת]+(?:["\'׳״][א-ת]+)*|[A-Za-z]+|\d+')
IMAGE_LINE = re.compile(r'^\S+\.(jpe?g|png|gif)$', re.I)
HEADING_STOP = {'ראו גם', 'קישורים חיצוניים', 'הערות שוליים', 'לקריאה נוספת', 'מקורות', 'ביבליוגרפיה'}

BYP_CREDIT = {'name': 'Project Ben-Yehuda volunteers', 'url': 'https://benyehuda.org',
              'license': 'Public domain'}


def clean(s):
    s = MARKS.sub('', s).replace('־', '-')
    return re.sub(r'[ \t ]+', ' ', s).strip()


def paragraph(text, heading=False):
    words = [[m.start(), m.end()] for m in WORD.finditer(text)]
    return {'t': text, 'w': words, **({'h': 1} if heading else {})}


def is_heading(line):
    return len(line.split()) <= 6 and not re.search(r'[.:?!,;]$', line)


def sections(paras):
    out, cur, n = [], [], 0
    for p in paras:
        if cur and n >= SECTION_WORDS and not p.get('h'):
            out.append(cur); cur, n = [], 0
        cur.append(p); n += len(p['w'])
    if cur:
        out.append(cur)
    return out


TOPICS_FILE = ROOT / 'data' / 'meta' / 'topics.json'
TOPIC_LABELS = {
    'animals-nature': 'Animals and nature', 'food-drink': 'Food and drink', 'science-space': 'Science and space',
    'history-places': 'History and places', 'folktales': 'Folktales and legends', 'jewish-life': 'Jewish life and tradition',
    'adventure': 'Adventure and travel', 'love-family': 'Love and family', 'ideas-society': 'Ideas and society',
    'humor': 'Humor and satire',
}


def facts(kind, id_, paras):
    """Difficulty, style, reading time, topics and blurb for one text."""
    body = [p for p in paras if not p.get('h')]
    words = [p['t'][a:b] for p in body for a, b in p['w']]
    sents = sum(max(1, len(re.findall(r'[.?!](?=\s|$)', p['t']))) for p in body)
    m = M.measure(words, sents)
    style = M.style_of(kind, words)
    sc = M.score(m, style)
    tags = json.loads(TOPICS_FILE.read_text()).get(f'{kind}/{id_}', {}) if TOPICS_FILE.exists() else {}
    return {'level': M.level_of(sc), 'score': sc, 'uncommon': round((1 - m['cov2k']) * 100), 'style': style,
            'minutes': max(1, round(len(words) / M.WORDS_PER_MINUTE)),
            'topics': tags.get('topics', []), 'blurb': tags.get('blurb', '')}


def write(kind, id_, meta, paras):
    d = OUT / kind / id_
    d.mkdir(parents=True, exist_ok=True)
    secs = sections(paras)
    for i, s in enumerate(secs):
        (d / f'{i}.json').write_text(json.dumps(s, ensure_ascii=False, separators=(',', ':')))
    words = sum(len(p['w']) for p in paras)
    full = {**meta, 'id': id_, 'kind': kind, 'words': words, 'sections': len(secs), **facts(kind, id_, paras)}
    (d / 'meta.json').write_text(json.dumps(full, ensure_ascii=False))
    return full


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    cat = {x['ID']: x for x in csv.DictReader(open(RAW / 'pseudocatalogue.csv', encoding='utf-8'))}
    books, articles = [], []

    for f in sorted((RAW / 'books').glob('*.txt')):
        row = cat[f.stem]
        lines = [clean(l) for l in f.read_text().split('\n')]
        # Ben-Yehuda texts keep the names of their picture files as stray lines: drop them.
        lines = [l for l in lines if l and not IMAGE_LINE.match(l)]
        paras = [paragraph(l, heading=is_heading(l)) for l in lines[1:]]
        title = clean(row['title'])
        meta = {'title': title, 'author': row['authors'].strip(),
                'translator': row['translators'].strip() or None, 'credit': BYP_CREDIT,
                'sourceUrl': f'https://benyehuda.org/read/{f.stem}'}
        books.append(write('books', f.stem, meta, paras))

    for f in sorted((RAW / 'articles').glob('*.json')):
        d = json.loads(f.read_text())
        paras = []
        for line in (clean(l) for l in d['text'].split('\n')):
            if not line:
                continue
            if is_heading(line) and line in HEADING_STOP:
                break
            paras.append(paragraph(line, heading=is_heading(line)))
        meta = {'title': d['title'], 'author': None, 'translator': None,
                'credit': {'name': 'Hebrew Wikipedia contributors',
                           'url': f"https://he.wikipedia.org/?curid={d['pageid']}",
                           'license': 'CC BY-SA 4.0'},
                'sourceUrl': f"https://he.wikipedia.org/?curid={d['pageid']}"}
        articles.append(write('articles', str(d['pageid']), meta, paras))

    key = lambda m: {k: m[k] for k in ('id', 'kind', 'title', 'author', 'words', 'sections', 'level', 'uncommon', 'style', 'minutes', 'topics', 'blurb')}
    (OUT / 'index.json').write_text(json.dumps(
        {'books': [key(m) for m in books], 'articles': [key(m) for m in articles],
         'topics': [{'key': k, 'label': v} for k, v in TOPIC_LABELS.items()]},
        ensure_ascii=False))
    for m in books + articles:
        print(f"{m['kind']:9} {m['id']:>8} {m['words']:>6} words  L{m['level']} {m['style']:8} {','.join(m['topics']):28} {m['title'][:30]}")


main()
