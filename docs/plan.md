# Plan

## Goal

An installable phone app (a PWA, added to the home screen). It also works on a laptop. A learner of modern Hebrew reads real texts and gets help with the words they do not know. What they look up becomes what they review.

## Decisions so far

- No nikud. The reader does not need a vowel toggle.
- Two shelves on the home screen, **Books** and **Articles**. Both open in the same reader.
- The texts are public domain books (Project Ben-Yehuda) and Hebrew Wikipedia articles.
- Word help comes from a language model, called from a small API route. It gets the word, its sentence and the title, and returns the meaning in context, the root, the part of speech and how to say it.
- Cache every lookup by word plus sentence, so the same lookup never costs twice.
- Phone first: design at 390px wide, test on a real phone. Wrap with Capacitor for the App Store later, only if wanted.
- Word help opens in a bottom sheet. Sentence translation uses a Translate button on each paragraph, not long-press, which clashes with system selection.
- Data lives in IndexedDB, not localStorage, because Safari can clear a site's storage after a week unused. Build Export and Import early.
- Flashcards use FSRS (the `ts-fsrs` library), one card per dictionary form, with the four Again, Hard, Good, Easy buttons and a daily cap on new cards.
- Stack: Vite, Solid and TypeScript. The API route is a Cloudflare Worker that also serves the built app.

## Known problems with the texts

- The books are not spoken-style Hebrew. Peretz and Brenner are literary. Mapu and Bialik's stories read like the Bible. Hebrew Wikipedia is the only modern text so far.
- Some Wikipedia text still has nikud in it. Strip it when splitting into words.
- Hebrew words carry attached prefixes (ו, ה, ב, ל, מ, ש, כ). Split them off so "the same word" counts as one lookup.

## Build order

0. **Model test.** About 30 words and 10 sentences from our texts, run through 4 or 5 OpenRouter models. Pick one per call type. Needs a new capped OpenRouter key.
1. **Texts to JSON.** DONE. `python3 -I scripts/build_texts.py` writes `public/texts/` (27 texts, 6,467 paragraphs). Each paragraph keeps its text plus word offsets, in sections of about 1,200 words so long books load in pieces.
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
