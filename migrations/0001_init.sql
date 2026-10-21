-- Sign-in by email link, one synced document per user, and anonymous word counts.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- One row per emailed link. Only a hash of the token is stored.
CREATE TABLE login_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX login_links_email ON login_links (email, created_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

-- Everything a learner keeps (lookups, known words, progress) as one JSON document.
CREATE TABLE sync_docs (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- How many readers looked a word up for the first time, per text. No ids, no accounts.
CREATE TABLE word_stats (
  lemma TEXT NOT NULL,
  text_key TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (lemma, text_key)
);
CREATE INDEX word_stats_text ON word_stats (text_key, n DESC);
