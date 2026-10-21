"""Find the easiest texts in the whole Ben-Yehuda catalogue, by measuring every prose text.

Needs the full dump from https://github.com/projectbenyehuda/public_domain_dump/releases
(txt_stripped.zip, about 250 MB) and data/raw/pseudocatalogue.csv.

Run: python3 -I scripts/scan_catalogue.py <txt_stripped.zip> [out.json]
Writes a JSON list of every measured text, easiest first, and prints the top of it.
"""
import csv, json, re, sys, zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import measure as M

ROOT = Path(__file__).resolve().parent.parent
IMAGE_LINE = re.compile(r'^\S+\.(jpe?g|png|gif)$', re.I)
WORD = re.compile(r'[א-ת]+(?:["\'׳״][א-ת]+)*')
MIN_WORDS, MAX_WORDS = 150, 6000


def main():
    zpath = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else 'scan.json'
    rows = [x for x in csv.DictReader(open(ROOT / 'data' / 'raw' / 'pseudocatalogue.csv', encoding='utf-8'))
            if x['genre'].endswith(('prose', 'fables'))]
    z = zipfile.ZipFile(zpath)
    names = {n.split('/', 1)[-1]: n for n in z.namelist() if n.endswith('.txt')}
    results = []
    for k, x in enumerate(rows):
        key = x['path'].lstrip('/') + '.txt'
        if key not in names:
            continue
        text = z.read(names[key]).decode('utf-8', 'ignore')
        lines = [l.strip() for l in text.split('\n')]
        lines = [l for l in lines[1:] if l and not IMAGE_LINE.match(l)]
        words = [w for l in lines for w in WORD.findall(l)]
        if not MIN_WORDS <= len(words) <= MAX_WORDS:
            continue
        sents = sum(max(1, len(re.findall(r'[.?!](?=\s|$)', l))) for l in lines)
        m = M.measure(words, sents)
        style = M.style_of('books', words)
        results.append({'id': x['ID'], 'title': re.sub('[֑-ׇ]', '', x['title']), 'author': x['authors'],
                        'translator': x['translators'], 'lang': x['original_language'], 'genre': x['genre'][-6:],
                        'words': len(words), 'uncommon': round((1 - m['cov2k']) * 100), 'cov1k': m['cov1k'],
                        'sentenceLen': m['sentenceLen'], 'style': style, 'score': M.score(m, style)})
        if k % 500 == 0:
            print(k, 'of', len(rows), file=sys.stderr)
    results.sort(key=lambda r: (r['score'], r['sentenceLen']))
    json.dump(results, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(results), 'texts measured')
    for r in results[:40]:
        print(f"{r['score']:3} unc {r['uncommon']:2} sl {r['sentenceLen']:4} {r['words']:5}w {r['style'][:4]} {r['lang']:2} {r['author'][:16]:16} | {r['title'][:36]}")


if __name__ == '__main__':
    main()
