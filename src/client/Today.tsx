import { createMemo, createResource, For, Show } from 'solid-js';
import { email } from '../lib/account.ts';
import { authorName } from '../lib/authors.ts';
import { dayKey, GOAL_CHOICES, minutesRead, streak, week } from '../lib/daily.ts';
import { days, goal, setGoal, topics } from '../lib/habit.ts';
import { keyOf, nextUp, STAGE_NAMES, upNextByTopics } from '../lib/path.ts';
import { buildQueue } from '../lib/review.ts';
import { cards, known, lookups, progress } from '../lib/store.ts';
import { getIndex } from '../lib/texts.ts';
import { Nav } from './Nav.tsx';
import { LevelBars, readingTime } from './TextRow.tsx';

const dateLine = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/** The learner's day: today's goal, the streak, what to continue, and what to read next. */
export function Today() {
  const [index] = createResource(getIndex);
  const now = new Date();
  const seconds = () => days()[dayKey(now)]?.s ?? 0;
  const minutes = () => minutesRead(seconds());
  const left = () => Math.max(0, (goal() ?? 0) - minutes());
  const fill = () => {
    const g = goal();
    return g ? Math.min(100, (seconds() / (g * 60)) * 100) : 0;
  };
  const words = () => new Set(lookups().map((l) => l.lemma)).size;
  const toReview = createMemo(() => buildQueue(lookups(), known(), cards()).items.length);
  const up = createMemo(() => (index() ? nextUp(index()!, progress()) : null));
  const topicLabel = (key: string) => index()?.topics.find((t) => t.key === key)?.label ?? key;
  const byTopic = createMemo(() => {
    const i = index();
    const t = topics();
    return i && t ? upNextByTopics(i, progress(), t, up() ? keyOf(up()!.text) : undefined) : [];
  });
  const sec = () => {
    const u = up();
    return u && u.mode === 'continue' ? (progress()[keyOf(u.text)]?.last ?? 0) : 0;
  };

  return (
    <>
      <div class="top">
        <div class="cap">{dateLine(now)}</div>
        <a
          href="#/account"
          class="signin-link"
          aria-label={email() ? 'Your account' : 'Sign in to keep your words on every device'}
        >
          <Show when={email()} fallback="Sign in">
            <span class="avatar">{(email() ?? '?').slice(0, 1).toUpperCase()}</span>
          </Show>
        </a>
      </div>
      <div class="tpage">
        <h1 class="serif th">Today</h1>

        <Show
          when={goal()}
          fallback={
            <div class="tblock">
              <h2 class="serif mh">How much do you want to read each day?</h2>
              <div class="opts">
                <For each={[...GOAL_CHOICES]}>
                  {(m) => (
                    <button type="button" class="opt" onClick={() => setGoal(m)}>
                      <b class="serif">{m}</b>
                      <span>minutes</span>
                    </button>
                  )}
                </For>
              </div>
            </div>
          }
        >
          {(g) => (
            <div class="tblock">
              <h2 class="serif mh">
                {Math.min(minutes(), g())} of {g()} minutes
              </h2>
              <div class="goalbar" role="progressbar" aria-valuenow={minutes()} aria-valuemax={g()}>
                <i style={{ width: `${fill()}%` }} />
              </div>
              <p class="msub" style={{ margin: '8px 0 0' }}>
                {left() > 0
                  ? `Read ${left()} more ${left() === 1 ? 'minute' : 'minutes'} to finish today.`
                  : 'You have finished today. Read on if you like.'}
              </p>
              <div class="week" role="img" aria-label="This week">
                <For each={week(days(), now)}>
                  {(d) => (
                    <div classList={{ day: true, now: d.today, met: d.met, future: d.future }}>
                      {d.letter}
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </Show>

        <div class="stats">
          <div>
            <b class="serif">{streak(days(), now)}</b>
            <span>{streak(days(), now) === 1 ? 'day in a row' : 'days in a row'}</span>
          </div>
          <div>
            <b class="serif">{words()}</b>
            <span>{words() === 1 ? 'word saved' : 'words saved'}</span>
          </div>
        </div>

        <Show when={toReview() > 0}>
          <a class="revcta" href="#/review">
            <span>
              <b class="serif">
                {toReview()} {toReview() === 1 ? 'word' : 'words'} to review
              </b>
              <small>About {Math.max(1, Math.round(toReview() / 3))} min</small>
            </span>
            <span class="go">Review →</span>
          </a>
        </Show>

        <Show when={up()}>
          {(u) => (
            <a class="cont" href={`#/read/${u().text.kind}/${u().text.id}/${sec()}`}>
              <div class="cap">{u().mode === 'continue' ? 'Continue' : 'Start'}</div>
              <div class="he ctitle">{u().text.title}</div>
              <div class="cmeta">
                <LevelBars level={u().text.level} />
                <span>{STAGE_NAMES[u().text.level - 1]}</span>
                <span>{readingTime(u().text.minutes)}</span>
                <span>{u().text.kind === 'articles' ? 'Hebrew Wikipedia' : authorName(u().text.author)}</span>
              </div>
              <span class="btn p wide">{u().mode === 'continue' ? 'Continue reading' : 'Start reading'}</span>
            </a>
          )}
        </Show>

        <div>
          <div class="cap" style={{ 'margin-bottom': '8px' }}>
            {topics() ? 'Up next, from your topics' : 'Up next'}
          </div>
          <Show
            when={topics()}
            fallback={
              <a class="toccta" href="#/topics">
                Pick three topics and we will choose for you →
              </a>
            }
          >
            <div class="toc">
              <For each={byTopic()}>
                {(p) => (
                  <a class="item" href={`#/read/${p.text.kind}/${p.text.id}/0`}>
                    <span class="mn">{readingTime(p.text.minutes)}</span>
                    <span class="lead" />
                    <span class="col">
                      <span class="he it">{p.text.title}</span>
                      <span class="sm">
                        {topicLabel(p.topic)} · {STAGE_NAMES[p.text.level - 1]}
                      </span>
                    </span>
                  </a>
                )}
              </For>
            </div>
            <a class="linkbtn" href="#/topics">
              Change topics
            </a>
          </Show>
        </div>

        <a class="linkbtn" href="#/library">
          Browse the whole library →
        </a>
        <a class="linkbtn" href="#/about" style={{ 'margin-top': '-10px' }}>
          About this app
        </a>
      </div>
      <div class="pad-nav" />
      <Nav on="read" />
    </>
  );
}
