"""Small SQL functions. Connections are short lived and writes are transactional."""
import hashlib
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .models import Draft, ResourceInput


@contextmanager
def connect(path: Path):
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def initialize(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as conn:
        conn.executescript(Path(__file__).with_name("schema.sql").read_text(encoding="utf-8"))
        if conn.execute("SELECT count(*) FROM resources").fetchone()[0] == 0:
            seed = json.loads(Path(__file__).with_name("seed.json").read_text(encoding="utf-8"))
            for item in seed["resources"]:
                insert_resource(conn, ResourceInput(**item))
            for source, target, kind in seed["relations"]:
                conn.execute("INSERT INTO relations VALUES (?, ?, ?)", (source, target, kind))


def set_tags(conn, resource_id, tags):
    conn.execute("DELETE FROM resource_tags WHERE resource_id = ?", (resource_id,))
    for tag in tags:
        conn.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (tag,))
        conn.execute(
            "INSERT INTO resource_tags SELECT ?, id FROM tags WHERE name = ?", (resource_id, tag)
        )


def insert_resource(conn, item: ResourceInput):
    cursor = conn.execute(
        "INSERT INTO resources(title,type,description,owner,url,reviewed_on) VALUES (?,?,?,?,?,?)",
        (item.title, item.type, item.description, item.owner, item.url,
         item.reviewed_on.isoformat() if item.reviewed_on else None),
    )
    set_tags(conn, cursor.lastrowid, item.tags)
    return cursor.lastrowid


def get_resource(conn, resource_id):
    row = conn.execute("SELECT * FROM resources WHERE id = ?", (resource_id,)).fetchone()
    if row is None:
        raise LookupError("Resource not found.")
    result = dict(row)
    result["tags"] = [r[0] for r in conn.execute(
        "SELECT t.name FROM tags t JOIN resource_tags rt ON t.id = rt.tag_id "
        "WHERE rt.resource_id = ? ORDER BY t.name", (resource_id,)
    )]
    return result


def list_resources(conn, q="", resource_type="", tag=""):
    # Values go into placeholders; user text is never concatenated into SQL.
    clauses, params = [], []
    if q:
        clauses.append("(instr(lower(r.title), lower(?)) > 0 OR instr(lower(r.description), lower(?)) > 0)")
        params.extend([q, q])
    if resource_type:
        clauses.append("r.type = ?")
        params.append(resource_type)
    if tag:
        clauses.append("EXISTS (SELECT 1 FROM resource_tags rt JOIN tags t ON t.id=rt.tag_id "
                       "WHERE rt.resource_id=r.id AND t.name=?)")
        params.append(tag)
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    ids = conn.execute("SELECT r.id FROM resources r" + where + " ORDER BY r.id DESC", params)
    return [get_resource(conn, row[0]) for row in ids.fetchall()]


def update_resource(conn, resource_id, item):
    get_resource(conn, resource_id)
    conn.execute(
        "UPDATE resources SET title=?,type=?,description=?,owner=?,url=?,reviewed_on=? WHERE id=?",
        (item.title, item.type, item.description, item.owner, item.url,
         item.reviewed_on.isoformat() if item.reviewed_on else None, resource_id),
    )
    set_tags(conn, resource_id, item.tags)


def add_relation(conn, source_id, target_id, kind):
    get_resource(conn, source_id)
    get_resource(conn, target_id)
    if source_id == target_id:
        raise ValueError("A resource cannot link to itself.")
    conn.execute("INSERT OR IGNORE INTO relations VALUES (?, ?, ?)", (source_id, target_id, kind))


def resource_relations(conn, resource_id):
    return [dict(row) for row in conn.execute(
        "SELECT l.*, s.title AS source_title, t.title AS target_title "
        "FROM relations l JOIN resources s ON s.id=l.source_id "
        "JOIN resources t ON t.id=l.target_id WHERE l.source_id=? OR l.target_id=? "
        "ORDER BY l.source_id,l.target_id", (resource_id, resource_id)
    )]


def duplicates(conn, title):
    return [dict(row) for row in conn.execute(
        "SELECT id,title FROM resources WHERE lower(trim(title))=lower(trim(?))", (title,)
    )]


def confirm_batch(conn, request_id: str, records: list[Draft]):
    payload = json.dumps([r.model_dump(mode="json") for r in records], sort_keys=True)
    digest = hashlib.sha256(payload.encode()).hexdigest()
    # Serialize the receipt lookup with the write, so concurrent retries are idempotent too.
    conn.execute("BEGIN IMMEDIATE")
    receipt = conn.execute("SELECT * FROM confirmations WHERE request_id=?", (request_id,)).fetchone()
    if receipt:
        if receipt["payload_hash"] != digest:
            raise ValueError("This request ID was already used for a different confirmation.")
        return json.loads(receipt["resource_ids"])
    ids = []
    for draft in records:
        item = ResourceInput(**draft.model_dump(exclude={"relations"}))
        resource_id = insert_resource(conn, item)
        ids.append(resource_id)
        for link in draft.relations:
            add_relation(conn, resource_id, link.target_id, link.kind)
    conn.execute("INSERT INTO confirmations VALUES (?,?,?)", (request_id, digest, json.dumps(ids)))
    return ids
