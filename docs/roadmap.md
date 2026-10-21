# Roadmap: the learning system

This is where the app goes after the reader works. Nothing here is built yet unless it says so.

## What we want

1. A word you looked up shows up underlined when you meet it again.
2. The app gives a small English hint over a word when you probably need it.
3. We learn from many readers which words trip people up.
4. We recommend books at the right level for each reader.
5. Daily goals and achievements, so reading becomes a habit.

## Where we are

- Built: a word you looked up is underlined, but only the exact spelling you tapped.
- Built: translating a sentence puts the right English word over each Hebrew word. The model reads the whole paragraph first, so "שאלו" comes out as "asked" and "חבריו" as "his friends".
- Not built: the rest.

## One idea that makes much of this cheap: translate the whole library once

The hints over words come from the same call that translates a sentence. That call costs a fraction of a cent. Our 27 texts hold about 219,000 words, roughly 18,000 sentences. We can run every sentence through it once, ahead of time, and ship the answers with the texts. My rough estimate is about $6 in total (18,000 calls at the fast model's prices). I have not run it.

Then:
- Translating a sentence is instant, with no model call.
- Hints can show over any word with no waiting.
- The model is only needed for the dictionary card on a tapped word (root, binyan, how to say it).

## Build order

**1. Smarter underline and hints (no other users needed).**
- Underline by dictionary form, so "שאלו" and "שואל" count as the same word. Each lookup teaches us one spelling-to-form link, and we share those links across readers.
- Underline gets darker the more times you looked a word up.
- A hint shows over a word once you have looked it up twice, or you tap "Hint mode" on.
- Needs: the library translated ahead of time.

**2. Reading goals and achievements (all on the phone).**
- A daily minimum: for example, finish one page or read for five minutes.
- Streaks, and a few badges (first word, 100 words, a finished text, a week in a row).
- Needs: a small record of what you read each day. No server.

**3. Learning from many readers.**
- Send an anonymous event for each lookup: which word, which text, where in it. No name, no account.
- Add up the events to show which words people look up most per thousand readers. That list drives the hints and the level estimates.
- Needs: a database table, a short privacy note on the site, and an opt-out switch. We should decide this before building it.

**4. Level and recommendations.**
- Give each reader a rough level from the words they know, measured against how common each word is in Hebrew.
- Rate each text by what share of its words a reader would not know. A good text for learning has about 2 to 5 unknown words in every 100.
- Recommend the next text that fits.
- Needs: the library tagged with dictionary forms and word frequency, and step 3 for the community's view of hard words.

**5. Accounts and syncing.**
- Sign in so your words and goals follow you between phone and laptop.
- This can wait. Until then, everything lives on the device.

## Decisions for Shaun

- Do we translate the whole library ahead of time? It is cheap and makes the app feel instant.
- Are anonymous lookup counts from readers fine, with a short privacy note and an opt-out? Or do we wait for accounts first?
- Should we start with goals and achievements (step 2), since they work without any other readers?
