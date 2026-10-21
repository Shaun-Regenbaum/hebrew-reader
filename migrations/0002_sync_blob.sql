-- The synced document is stored gzipped, so a long history still fits in one row.
DROP TABLE sync_docs;
CREATE TABLE sync_docs (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);
