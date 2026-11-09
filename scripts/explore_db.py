"""Read-only SQL exercises: run after starting Atlas at least once."""
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from atlas.config import read_settings

path = read_settings().database.resolve()
if not path.exists():
    raise SystemExit("Start Atlas once to create the database, then try again.")

queries = {
    "Resources per type": "SELECT type, count(*) AS total FROM resources GROUP BY type",
    "Resources with the events tag": """
        SELECT r.id, r.title, t.name
        FROM resources r
        JOIN resource_tags rt ON rt.resource_id = r.id
        JOIN tags t ON t.id = rt.tag_id
        WHERE t.name = 'events'
    """,
    "Resources missing an owner": "SELECT id, title FROM resources WHERE owner = ''",
}
with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as conn:
    for title, sql in queries.items():
        print(f"\n{title}\n{sql.strip()}")
        for row in conn.execute(sql):
            print(row)
