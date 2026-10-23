import { Nav } from './Nav.tsx';

/** What this is, where the texts come from, and what is kept about you. Plain words, no sales pitch. */
export function About() {
  return (
    <>
      <div class="top">
        <a href="#/" class="signin-link">
          ‹ Today
        </a>
        <div class="serif" style={{ 'font-size': '24px', 'font-weight': '500' }}>
          About
        </div>
      </div>
      <div class="tpage about">
        <section>
          <h2 class="serif mh">What this is</h2>
          <p>
            Read Hebrew is for reading real modern Hebrew. You pick a text, tap any word you do not know, and
            see what it means in that sentence. Each word you tap becomes a flashcard. A daily reading goal
            keeps you coming back.
          </p>
        </section>

        <section>
          <h2 class="serif mh">How it works</h2>
          <ol>
            <li>Tap a word. You see its meaning here, its dictionary form, its root and how to say it.</li>
            <li>
              Tap Translate sentence to see the whole sentence in English, with the meaning over each word.
            </li>
            <li>Words you looked up are underlined, and show a small hint when they come up again.</li>
            <li>Review turns your words into flashcards. The app decides when each one should come back.</li>
            <li>Choose how many minutes to read each day. Your streak counts the days you reach it.</li>
          </ol>
        </section>

        <section>
          <h2 class="serif mh">How we rate difficulty</h2>
          <p>
            We compare the words in each text with a list of the most common words in everyday Hebrew. The
            more words fall outside the 2,000 most common forms, the higher the level. Old-fashioned writing
            adds to the level. The levels compare the texts in this library with each other. Even Level 1 is
            hard for a true beginner.
          </p>
        </section>

        <section>
          <h2 class="serif mh">Where the texts come from</h2>
          <p>
            Stories and books are in the public domain, from the volunteers of{' '}
            <a class="lk" href="https://benyehuda.org" target="_blank" rel="noopener noreferrer">
              Project Ben-Yehuda
            </a>
            . Articles are from Hebrew Wikipedia, shared under the{' '}
            <a
              class="lk"
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY-SA 4.0
            </a>{' '}
            license. Every text shows its source and license at the end. Difficulty uses the{' '}
            <a
              class="lk"
              href="https://github.com/hermitdave/FrequencyWords"
              target="_blank"
              rel="noopener noreferrer"
            >
              FrequencyWords
            </a>{' '}
            list.
          </p>
        </section>

        <section>
          <h2 class="serif mh">What is kept about you</h2>
          <p>
            Your words, progress, goal and flashcards stay on your device. If you sign in with your email, a
            copy is saved on our server so it follows you to other devices. We use your email only to send
            your sign-in link.
          </p>
          <p>
            To work out a meaning, the sentence you tapped and the paragraph around it are sent to an AI
            service. Answers are saved, so the next reader of the same sentence gets it instantly.
          </p>
        </section>

        <section>
          <h2 class="serif mh">Open source</h2>
          <p>
            The code is public and free to reuse under the MIT license:{' '}
            <a
              class="lk"
              href="https://github.com/Shaun-Regenbaum/hebrew-reader"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/Shaun-Regenbaum/hebrew-reader
            </a>
            .
          </p>
        </section>
      </div>
      <div class="pad-nav" />
      <Nav on="read" />
    </>
  );
}
