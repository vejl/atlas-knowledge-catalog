from pathlib import Path

import pytest

from atlas.csv_check import MAX_BYTES, check_csv

SAMPLES = Path(__file__).resolve().parents[1] / "samples"


def test_valid_and_semicolon_samples():
    for name, rows, delimiter in [("events-valid.csv",3,","),("events-semicolon.csv",2,";")]:
        result = check_csv((SAMPLES / name).read_bytes())
        assert result["rows"] == rows
        assert result["delimiter"] == delimiter
        assert result["issues"] == []


def test_error_fixture_exact_locations():
    result = check_csv((SAMPLES / "events-errors.csv").read_bytes())
    assert result["rows"] == 4
    assert result["errors"] == 5
    assert result["warnings"] == 1
    assert [(i["row"],i["column"]) for i in result["issues"]] == [
        (3,"event_id"),(4,"title"),(4,"event_date"),(4,"capacity"),(4,"registered"),(5,"registered")]


def test_utf8_bom_and_quoted_delimiter():
    text = '\ufeffevent_id;title;event_date;capacity;registered\n1;"Workshop; SQL";2026-11-06;10;0\n'
    assert check_csv(text.encode())["issues"] == []


def test_real_date_and_integer_rules():
    content = b"event_id,title,event_date,capacity,registered\n1,Test,20261106,1.5,-1\n"
    result = check_csv(content)
    assert [i["column"] for i in result["issues"]] == ["event_date","capacity","registered"]


def test_missing_and_duplicate_headers():
    result = check_csv(b"event_id,title\n1,Test\n")
    assert result["errors"] == 3
    assert all(i["row"] == 1 for i in result["issues"])
    with pytest.raises(ValueError, match="duplicate column"):
        check_csv(b"event_id,event_id,title\n1,2,Test")


def test_bad_encoding_empty_oversize_and_malformed():
    for content in [b"",b"\xff\xfe",b"a" * (MAX_BYTES+1),
                    b'event_id,title,event_date,capacity,registered\n1,"unclosed,2026-11-06,2,1']:
        with pytest.raises(ValueError):
            check_csv(content)


def test_column_count_and_blank_lines():
    result = check_csv(b"event_id,title,event_date,capacity,registered\n\n1,Test,2026-11-06,2\n")
    assert result["rows"] == 1
    assert result["issues"][0]["row"] == 3


def test_upload_limit_and_no_persistence(client):
    response = client.post("/api/csv/check", files={"file":("events.csv",(SAMPLES/"events-errors.csv").read_bytes(),"text/csv")})
    assert response.json()["errors"] == 5
    assert len(client.get("/api/resources").json()) == 12
    large = client.post("/api/csv/check", files={"file":("big.csv",b"x" * (MAX_BYTES+1),"text/csv")})
    assert large.status_code == 413
