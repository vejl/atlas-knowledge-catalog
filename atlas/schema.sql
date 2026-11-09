PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL CHECK(length(trim(title)) > 0),
    type TEXT NOT NULL CHECK(type IN ('document', 'dataset', 'report')),
    description TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    reviewed_on TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS resource_tags (
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY(resource_id, tag_id)
);
CREATE TABLE IF NOT EXISTS relations (
    source_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('describes','derived from','related to')),
    PRIMARY KEY(source_id, target_id, kind),
    CHECK(source_id <> target_id)
);
-- A receipt prevents a double click or network retry from saving the same batch twice.
CREATE TABLE IF NOT EXISTS confirmations (
    request_id TEXT PRIMARY KEY,
    payload_hash TEXT NOT NULL,
    resource_ids TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS resources_type ON resources(type);
