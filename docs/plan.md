# Plan

## Goal

A phone-friendly web app. A learner of modern Hebrew reads real texts and gets help with the words they do not know. What they look up becomes what they review.

## Decisions so far

- No nikud. The reader does not need a vowel toggle.
- Two shelves on the home screen, **Books** and **Articles**. Both open in the same reader.
- The texts are public domain books (Project Ben-Yehuda) and Hebrew Wikipedia articles.
- Word help comes from a language model, called from a small API route. It gets the word, its sentence and the title, and returns the meaning in context, the root, the part of speech and how to say it.
- Cache every lookup by word plus sentence, so the same lookup never costs twice.
- Stack: Vite, Solid and TypeScript. The API route is a Cloudflare Worker that also serves the built app.

## Known problems with the texts

- The books are not spoken-style Hebrew. Peretz and Brenner are literary. Mapu and Bialik's stories read like the Bible. Hebrew Wikipedia is the only modern text so far.
- Some Wikipedia text still has nikud in it. Strip it when splitting into words.
- Hebrew words carry attached prefixes (ו, ה, ב, ל, מ, ש, כ). Split them off so "the same word" counts as one lookup.

## Build order

1. **Texts to JSON.** A script turns each raw file into paragraphs and words. Output goes in `data/books/` and `data/articles/`.
2. **Reader.** Right-to-left view, font size, mobile layout, Books and Articles shelves.
3. **Tap a word.** Popup backed by the API route and a cache. Each lookup saves to localStorage with the word, sentence, text and time.
4. **Translate a selection.** Select a sentence or paragraph and get natural English.
5. **Flashcards.** Cards come from lookups. Review uses the SM-2 schedule.
6. **My words.** Lookups by how often and by text. Mark a word as known.
7. **Quiz.** The 10 words looked up most in a chapter become a 5-question quiz.
8. **Landing page and deploy.** One line explaining the idea and a Start reading button. Put a rate limit and a spend cap on the public translate route.

Steps 1 to 4 plus a deploy make the first working version.

## Open questions

- Which model and API key to use. The talmud and tanach apps share one OpenRouter credit pool, so this app should get its own capped key.
- Whether to add books that read closer to spoken Hebrew, such as translations from the 1920s to 40s.
