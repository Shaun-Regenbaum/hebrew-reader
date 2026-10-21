# hebrew-reader

A reader for learning modern Hebrew. You read real texts, tap any word you don't know, and the app turns your lookups into flashcards.

Status: just started. Right now the repo holds the starter texts and the plan. There is no app yet.

## The idea

1. Read a book or an article in Hebrew.
2. Tap a word. See what it means in this sentence, its root, and how to say it.
3. Every lookup is saved. The words you look up most become flashcards and short quizzes.

## What is here

- `data/raw/books/` holds 17 public domain books and stories from Project Ben-Yehuda.
- `data/raw/articles/` holds 11 Hebrew Wikipedia articles.
- `data/raw/pseudocatalogue.csv` lists about 26,000 more Ben-Yehuda works we can add.
- `scripts/fetch.py` downloads all of it again.
- `docs/plan.md` has the build plan.
- `DATA.md` has the licenses and credits for the texts.

## Get the texts

```bash
curl -L -o data/raw/pseudocatalogue.csv https://raw.githubusercontent.com/projectbenyehuda/public_domain_dump/master/pseudocatalogue.csv
python3 -I scripts/fetch.py data/raw/pseudocatalogue.csv
```

## Licenses

The code is MIT. The texts have their own terms: see `DATA.md`.
