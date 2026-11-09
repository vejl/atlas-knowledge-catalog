from fastapi.testclient import TestClient

from atlas import db
from atlas.main import create_app


def test_seed_and_filters(client):
    assert len(client.get("/api/resources").json()) == 12
    assert len(client.get("/api/resources?type=dataset").json()) == 4
    found = client.get("/api/resources?q=registration&type=document&tag=volunteers").json()
    assert [r["title"] for r in found] == ["Volunteer registration guide"]
    assert client.get("/api/status").json()["relations"] == 7


def test_create_update_persist_and_tags(client, settings):
    resource = {"title":"New dataset","type":"dataset","tags":[" Events ","events","new"]}
    created = client.post("/api/resources", json=resource)
    assert created.status_code == 201
    resource_id = created.json()["id"]
    assert created.json()["tags"] == ["events", "new"]
    resource.update(title="Updated dataset", owner="Test Organiser", reviewed_on="2026-11-06")
    assert client.put(f"/api/resources/{resource_id}", json=resource).status_code == 200
    with TestClient(create_app(settings)) as restarted:
        result = restarted.get(f"/api/resources/{resource_id}").json()
        assert result["title"] == "Updated dataset"
        assert result["reviewed_on"] == "2026-11-06"
        assert len(restarted.get("/api/resources").json()) == 13


def test_empty_title_and_invalid_url_rejected(client):
    for resource in [dict(title="  ",type="document"),dict(title="Test",type="script"),
                     dict(title="Test",type="document",url="javascript:alert(1)"),
                     dict(title="Test",type="document",reviewed_on="2026-02-30")]:
        assert client.post("/api/resources", json=resource).status_code == 422


def test_relations_are_directed_valid_and_deduplicated(client):
    endpoint = "/api/resources/2/relations"
    body = dict(target_id=5,kind="related to")
    assert client.post(endpoint, json=body).status_code == 201
    assert client.post(endpoint, json=body).status_code == 201
    links = client.get("/api/resources/2").json()["relations"]
    assert sum(l["source_id"] == 2 and l["target_id"] == 5 for l in links) == 1
    assert client.post(endpoint, json=dict(target_id=2,kind="related to")).status_code == 400
    assert client.post(endpoint, json=dict(target_id=9999,kind="related to")).status_code == 404


def test_parameterized_search_and_html_are_data(client):
    assert client.get("/api/resources", params={"q":"' OR 1=1 --"}).json() == []
    body = dict(title="<script>alert(1)</script>",type="document")
    assert client.post("/api/resources", json=body).json()["title"] == body["title"]
    assert len(client.get("/api/resources").json()) == 13


def test_foreign_keys_enabled(settings, client):
    with db.connect(settings.database) as conn:
        assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_cross_origin_write_and_unknown_hosts_rejected(client):
    response = client.post("/api/resources", json=dict(title="Test",type="document"),
                           headers={"Origin":"https://other.example"})
    assert response.status_code == 403
    assert client.get("/api/status", headers={"Host":"evil.example"}).status_code == 400


def test_home_and_sample_allowlist(client):
    home = client.get("/")
    assert home.status_code == 200
    assert "script-src 'self'" in home.headers["content-security-policy"]
    assert client.get("/samples/events-valid.csv").status_code == 200
    assert client.get("/samples/.env").status_code == 404
    assert client.get("/api/resources/99999").status_code == 404
