"""Choose the beginner texts from a catalogue scan, and write data/meta/beginner.json.

Reads the output of scan_catalogue.py. The rules are written here so the choice can be redone or changed:
  - children's authors (Dushman, Bergstein): measured score up to 48
  - Katznelson (stories and fables for children): score up to 45
  - one Grimm tale that scores as easy as the primers
  - 150 to 3,200 words, one copy of each title
Run: python3 -I scripts/pick_beginner.py <scan.json>
"""
import json, re, sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'data' / 'meta' / 'beginner.json'
RULES = [  # (author contains, max score)
    ('ישראל דושמן', 48),
    ('פניה ברגשטיין', 48),
    ('יצחק קצנלסון', 45),
]
GRIMM = ('וילהלם גרים', 'דן הפקח')
LONG_READS = ['11440']  # Pinocchio, translated by Dushman: a children's novel, 29,000 words
MIN_W, MAX_W = 150, 3200


def norm(t):
    return re.sub(r'[^א-ת]', '', t)


def main():
    scan = json.load(open(sys.argv[1], encoding='utf-8'))
    picked, seen = [], set()
    for r in scan:
        if not MIN_W <= r['words'] <= MAX_W:
            continue
        ok = any(a in r['author'] and r['score'] <= cap for a, cap in RULES)
        ok = ok or (GRIMM[0] in r['author'] and norm(GRIMM[1]) == norm(r['title']))
        key = (r['author'], norm(r['title']))
        if ok and key not in seen:
            seen.add(key)
            picked.append({k: r[k] for k in ('id', 'title', 'author', 'words', 'score', 'sentenceLen')})
    json.dump({'texts': picked, 'longReads': LONG_READS}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    by = {}
    for p in picked:
        by[p['author'][:18]] = by.get(p['author'][:18], 0) + 1
    print(len(picked), 'texts picked:', by, '; total words', sum(p['words'] for p in picked))


if __name__ == '__main__':
    main()
