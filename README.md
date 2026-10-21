# hebrew-reader

A reader for learning modern Hebrew. You read real texts, tap any word you don't know, and the app turns your lookups into flashcards.

Status: first working version, live at https://learning.402.app

Done: a guided home (up next, a five-stage path, topics), measured difficulty for every text, the reader with a scroll view and a page view, tap a word for its meaning, translate a sentence with an English word over each Hebrew word, saved lookups, reading progress, and My words with a Known toggle.
Stubbed: Review (flashcards), the quiz, and the landing page. Lookups are already saved for them.

## The idea

1. Read a book or an article in Hebrew.
2. Tap a word. See what it means in this sentence, its root, and how to say it.
3. Every lookup is saved. The words you look up most become flashcards and short quizzes.

## What is here

- `data/raw/books/` holds 17 public domain books and stories from Project Ben-Yehuda.
- `data/raw/articles/` holds 11 Hebrew Wikipedia articles.
- `data/raw/pseudocatalogue.csv` lists about 26,000 more Ben-Yehuda works we can add.
- `scripts/fetch.py` downloads all of it again.
- `scripts/build_texts.py` turns it into the JSON the reader loads (`public/texts/`, not committed). It also adds each text's level, style, reading time, topics and description.
- `scripts/measure.py` rates difficulty from word frequency (`python3 -I scripts/measure.py` prints a table).
- `scripts/tag_topics.py` asks the model for each text's topics and one-line description. Results are in `data/meta/topics.json`, reviewed by hand.
- `docs/plan.md` has the build plan.
- `DATA.md` has the licenses and credits for the texts.

## Run it

```bash
pnpm install
pnpm texts          # builds public/texts from data/raw
echo 'OPENROUTER_API_KEY=...' > .dev.vars
pnpm dev
pnpm test
```

Deploy (account that owns 402.app): `CLOUDFLARE_ACCOUNT_ID=ddf8edfc3dfd489567fe3c5b28b51aca pnpm build && wrangler deploy`

## Get the texts

```bash
curl -L -o data/raw/pseudocatalogue.csv https://raw.githubusercontent.com/projectbenyehuda/public_domain_dump/master/pseudocatalogue.csv
python3 -I scripts/fetch.py data/raw/pseudocatalogue.csv
```

## Licenses

The code is MIT. The texts have their own terms: see `DATA.md`.
