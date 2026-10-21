"""Pull the starter Hebrew texts into data/raw. Run: python3 -I scripts/fetch.py <catalogue.csv>
Books: Project Ben-Yehuda public domain dump (txt_stripped, no nikud).
Articles: Hebrew Wikipedia plain-text extracts (CC BY-SA)."""
import csv, json, sys, urllib.parse, urllib.request

BASE = 'https://raw.githubusercontent.com/projectbenyehuda/public_domain_dump/master/txt_stripped'
BOOK_IDS = ['7260', '957', '6408', '665', '1002', '1005', '113', '208', '181', '6309',
            '5277', '11873', '420', '1364', '1385', '1386', '1126']
ARTICLES = ['חתול', 'אלברט איינשטיין', 'שינה', 'קפה', 'ים המלח', 'הירח', 'דבורת הדבש',
            'נמלה', 'טיטאניק', 'פיצה', 'שוקולד']
UA = 'hebrew-reader-demo/0.1'

cat = {x['ID']: x for x in csv.DictReader(open(sys.argv[1], encoding='utf-8'))}
for i in BOOK_IDS:
    t = urllib.request.urlopen(BASE + cat[i]['path'] + '.txt', timeout=60).read().decode()
    open(f'data/raw/books/{i}.txt', 'w').write(t)
for title in ARTICLES:
    q = urllib.parse.urlencode({'action': 'query', 'prop': 'extracts', 'explaintext': 1,
                                'exsectionformat': 'plain', 'titles': title, 'format': 'json',
                                'redirects': 1, 'formatversion': 2})
    req = urllib.request.Request('https://he.wikipedia.org/w/api.php?' + q, headers={'User-Agent': UA})
    p = json.load(urllib.request.urlopen(req, timeout=30))['query']['pages'][0]
    json.dump({'title': p['title'], 'pageid': p['pageid'], 'text': p.get('extract', '')},
              open(f'data/raw/articles/{p["pageid"]}.json', 'w'), ensure_ascii=False)
