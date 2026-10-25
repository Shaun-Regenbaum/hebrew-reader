"""Turn data/raw into the JSON the reader loads, in public/texts.

Run: python3 -I scripts/build_texts.py          builds the texts listed in data/meta/curated.json
     python3 -I scripts/build_texts.py --all    builds every text in data/raw

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
from taxonomy import TOPICS
RAW, OUT = ROOT / 'data' / 'raw', ROOT / 'public' / 'texts'
SECTION_WORDS = 1200

# Hebrew marks: cantillation and nikud, except the maqaf (U+05BE), which joins words.
MARKS = re.compile('[֑-ֽֿׁ-ׇ]')
WORD = re.compile(r'[א-ת]+(?:["\'׳״][א-ת]+)*|[A-Za-z]+|\d+')
IMAGE_LINE = re.compile(r'^.{1,80}\.(jpe?g|png|gif|webp|svg)$', re.I)
HEADING_STOP = {'ראו גם', 'קישורים חיצוניים', 'הערות שוליים', 'לקריאה נוספת', 'מקורות', 'ביבליוגרפיה'}

BYP_CREDIT = {'name': 'Project Ben-Yehuda volunteers', 'url': 'https://benyehuda.org',
              'license': 'Public domain'}


# Invisible left-to-right and right-to-left marks that Wikipedia puts around numbers.
INVISIBLE = re.compile('[\u200e\u200f\u202a-\u202e\u2066-\u2069]')
# Ben-Yehuda ends every text with a credit line; the app shows the credit itself.
CREDIT_LINE = re.compile(r'פרויקט בן.יהודה באינטרנט|benyehuda\.org/read')
# A footnote definition in Ben-Yehuda's markdown ends with a return arrow.
FOOTNOTE_LINE = re.compile('↩')
# A line of nothing but dashes or symbols: a scene break in print, noise here.
DIVIDER = re.compile(r'^[\s\W_]{3,}$')
# A reference letter or number in square brackets, as in [1] or [ו].
REF_MARK = re.compile(r'\s?\[(?:\d{1,3}|[א-ת])\]')


def clean(s):
    s = INVISIBLE.sub('', MARKS.sub('', s)).replace('־', '-').replace('*', '')
    return re.sub(r'[ \t ]+', ' ', s).strip()


def paragraph(text, heading=False):
    words = [[m.start(), m.end()] for m in WORD.finditer(text)]
    return {'t': text, 'w': words, **({'h': 1} if heading else {})}


def is_heading(line):
    # a short line that ends in a quote or starts with a dash or quote is speech, not a heading
    return (len(line.split()) <= 6 and not re.search(r'[.:?!,;"”\']$', line)
            and not line.startswith(('–', '-', '"', '“')))


def wrapped(block):
    """Is this block of lines ordinary prose that the source file cut at a fixed width?
    Lines that stop at arbitrary words (not at a comma or full stop) and are long enough to be cut by width."""
    body = block[:-1]
    if not body or any(len(l) < 28 for l in body):
        return False
    stops = sum(1 for l in body if re.search(r'[.,;:?!]$', l))
    return stops / len(body) <= 0.35


def book_body(lines, author, title):
    """The story itself: drop the credit line, footnotes, dividers, a repeated title or author, and a preface."""
    # footnotes sit in their own blocks at the end, each block ending in a return arrow
    blocks, block = [], []
    for l in lines + ['']:
        if l:
            block.append(l)
        elif block:
            blocks.append(block)
            block = []
    has_notes = any(FOOTNOTE_LINE.search(l) for b in blocks for l in b)
    out = []
    for b in blocks:
        if any(FOOTNOTE_LINE.search(l) for l in b):
            continue
        b = [l for l in b if not (CREDIT_LINE.search(l) or DIVIDER.match(l))]
        if has_notes:
            # footnote numbers are stuck to the end of a word: קולודי1,
            b = [re.sub(r'(?<=[א-ת])\d{1,3}(?=[\s,.;:!?"\')\-]|$)', '', l) for l in b]
        if b:
            out += b + ['']
    # the title or the author's name, repeated on the first line after the title
    if out:
        first = out[0]
        if first == title or first == author or (title in first and author and author in first):
            out = out[1:]
            while out and not out[0]:
                out = out[1:]
    # a preface by the publisher: from "הקדמה" up to the first chapter
    if out and out[0] == 'הקדמה':
        chapter = next((i for i, l in enumerate(out) if re.match(r'^פרק\b', l)), None)
        if chapter is not None:
            out = out[chapter:]
    return out


def split_dialogue(block):
    """Joined lines run on without blank lines in some books. A line that opens with a quote or a dash, after a
    line that ended a sentence, is a new speaker: start a new paragraph."""
    parts, cur = [], []
    for l in block:
        if cur and re.search(r'[.!?…"”]$', cur[-1]) and re.match(r'^["“–—-]', l):
            parts.append(' '.join(cur))
            cur = []
        cur.append(l)
    parts.append(' '.join(cur))
    return parts


def split_long(text, soft=600, hard=900):
    """A paragraph longer than `hard` characters is cut after the first sentence end past `soft`."""
    out = []
    while len(text) > hard:
        m = re.search(r'[.!?…]["”]?\s', text[soft:])
        if not m:
            break
        cut = soft + m.end()
        out.append(text[:cut].strip())
        text = text[cut:].strip()
    out.append(text)
    return out


def unwrap(lines):
    """Group lines by blank lines. A block that was cut at a fixed width becomes one paragraph.
    Yields (text, was_joined)."""
    block = []
    for l in lines + ['']:
        if l:
            block.append(l)
            continue
        if block:
            if wrapped(block):
                for part in split_dialogue(block):
                    for piece in split_long(part):
                        yield piece, True
            else:
                for b in block:
                    yield b, False
        block = []


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
TOPIC_LABELS = TOPICS


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


def curated():
    """The (kind, id) pairs the app shows, or None to build everything."""
    f = ROOT / 'data' / 'meta' / 'curated.json'
    if '--all' in sys.argv or not f.exists():
        return None
    return {(t['kind'], t['id']) for t in json.loads(f.read_text())['texts']}


def main():
    shown = curated()
    if OUT.exists():
        shutil.rmtree(OUT)
    cat = {x['ID']: x for x in csv.DictReader(open(RAW / 'pseudocatalogue.csv', encoding='utf-8'))}
    books, articles = [], []

    for f in sorted((RAW / 'books').glob('*.txt')):
        if shown is not None and ('books', f.stem) not in shown:
            continue
        row = cat[f.stem]
        lines = [clean(l) for l in f.read_text().split('\n')]
        # Ben-Yehuda texts keep the names of their picture files as stray lines: drop them.
        lines = [l for l in lines if not IMAGE_LINE.match(l)]
        first = next(i for i, l in enumerate(lines) if l)
        body = book_body(lines[first + 1:], clean(row['authors']), clean(row['title']))
        paras = [paragraph(l, heading=is_heading(l) and not joined) for l, joined in unwrap(body)]
        title = clean(row['title'])
        meta = {'title': title, 'author': row['authors'].strip(),
                'translator': row['translators'].strip() or None, 'credit': BYP_CREDIT,
                'sourceUrl': f'https://benyehuda.org/read/{f.stem}'}
        books.append(write('books', f.stem, meta, paras))

    for f in sorted((RAW / 'articles').glob('*.json')):
        d = json.loads(f.read_text())
        if shown is not None and ('articles', str(d['pageid'])) not in shown:
            continue
        paras = []
        for line in (REF_MARK.sub('', clean(l)) for l in d['text'].split('\n')):
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
