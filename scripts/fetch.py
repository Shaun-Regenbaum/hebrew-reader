"""Pull the starter Hebrew texts into data/raw. Run: python3 -I scripts/fetch.py <catalogue.csv>
Books: Project Ben-Yehuda public domain dump (txt_stripped, no nikud).
Articles: Hebrew Wikipedia plain-text extracts (CC BY-SA)."""
import csv, glob, json, re, sys, time, urllib.parse, urllib.request

BASE = 'https://raw.githubusercontent.com/projectbenyehuda/public_domain_dump/master/txt_stripped'
BOOK_IDS = ['7260', '957', '6408', '665', '1002', '1005', '113', '208', '181', '6309',
            '5277', '11873', '420', '1364', '1385', '1386', '1126']
ARTICLES = ['חתול', 'אלברט איינשטיין', 'שינה', 'קפה', 'ים המלח', 'הירח', 'דבורת הדבש', 'נמלה', 'טיטאניק', 'פיצה', 'שוקולד',
            # science and space
            'השמש', 'מערכת השמש', 'חור שחור', 'כדור הארץ', 'כוכב לכת', 'מאדים', 'אבולוציה', 'דנ"א', 'פוטוסינתזה', 'אטום',
            'כוח המשיכה', 'חשמל', 'רעידת אדמה', 'הר געש', 'קשת בענן', 'ברק', 'ענן',
            # technology
            'אינטרנט', 'מחשב', 'טלפון חכם', 'רובוט', 'בינה מלאכותית', 'מצלמה', 'מטוס', 'רכבת', 'אופניים',
            # the body and health
            'לב', 'מוח', 'חיסון', 'ויטמין', 'עין', 'שן',
            # animals
            'דולפין', 'פיל', 'פינגווין', 'כריש', 'אריה', 'ינשוף',
            # sports and games
            'כדורגל', 'שחמט', 'כדורסל', 'טניס', 'משחקים אולימפיים',
            # music and art
            'פסנתר', 'גיטרה', 'מוזיקה', 'ציור',
            # places and history
            'ירושלים', 'מצרים העתיקה', 'פירמידות מצרים', 'תל אביב-יפו', 'רומא', 'אתונה',
            # people
            'מארי קירי', 'לאונרדו דה וינצ\'י', 'תומאס אדיסון', 'אייזק ניוטון', 'דוד בן-גוריון',
            # food
            'תה', 'לחם', 'גבינה', 'דבש', 'פלאפל', 'חומוס']
UA = 'hebrew-reader-demo/0.1'

def clean_math(text):
    """Drop the {\\displaystyle ...} formulas the extract API leaves in science articles."""
    while True:
        i = text.find('{\\displaystyle')
        if i < 0:
            break
        depth, j = 0, i
        while j < len(text):
            depth += {'{': 1, '}': -1}.get(text[j], 0)
            j += 1
            if depth == 0:
                break
        text = text[:i] + text[j:]
    return re.sub(r'[ \t]{2,}', ' ', text)


def cap(text, soft=1800, hard=3200):
    """Cut a long article at a section break once it is long enough, or at a paragraph end at the hard limit."""
    out, n = [], 0
    lines = text.split('\n')
    for k, line in enumerate(lines):
        w = len(line.split())
        heading = 0 < w <= 6 and not re.search(r'[.:?!,;]$', line.strip()) and k + 1 < len(lines)
        if heading and n >= soft:
            break
        out.append(line)
        n += w
        if n >= hard and not heading:
            break
    return '\n'.join(out).rstrip()


def fetch_article(title):
    q = urllib.parse.urlencode({'action': 'query', 'prop': 'extracts', 'explaintext': 1, 'exsectionformat': 'plain',
                                'titles': title, 'format': 'json', 'redirects': 1, 'formatversion': 2})
    req = urllib.request.Request('https://he.wikipedia.org/w/api.php?' + q, headers={'User-Agent': UA})
    for attempt in range(5):
        try:
            return json.load(urllib.request.urlopen(req, timeout=30))['query']['pages'][0]
        except Exception:
            time.sleep(3 * (attempt + 1))
    return None



def main():
    cat = {x['ID']: x for x in csv.DictReader(open(sys.argv[1], encoding='utf-8'))}
    beginner = json.load(open('data/meta/beginner.json'))
    for i in BOOK_IDS + [t['id'] for t in beginner['texts']] + beginner['longReads']:
        t = urllib.request.urlopen(BASE + cat[i]['path'] + '.txt', timeout=60).read().decode()
        open(f'data/raw/books/{i}.txt', 'w').write(t)
    have = {json.load(open(f))['title'] for f in glob.glob('data/raw/articles/*.json')}
    for title in ARTICLES:
        p = fetch_article(title)
        time.sleep(1.2)
        text = (p or {}).get('extract') or ''
        if not p or 'missing' in p or len(text.split()) < 300 or 'עשוי להתייחס ל' in text[:300]:
            print('skip', title, '(missing, too short, or a disambiguation page)')
            continue
        if p['title'] in have:
            continue
        text = cap(clean_math(text))
        json.dump({'title': p['title'], 'pageid': p['pageid'], 'text': text},
                  open(f'data/raw/articles/{p["pageid"]}.json', 'w'), ensure_ascii=False)
        print('ok  ', title, '->', p['title'], len(text.split()), 'words')
    # tidy what we already have, so every article has gone through the same cleaning and length cap
    for f in glob.glob('data/raw/articles/*.json'):
        d = json.load(open(f))
        tidy = cap(clean_math(d['text']))
        if tidy != d['text']:
            d['text'] = tidy
            json.dump(d, open(f, 'w'), ensure_ascii=False)
            print('tidied', d['title'], len(tidy.split()), 'words')


if __name__ == '__main__':
    main()
