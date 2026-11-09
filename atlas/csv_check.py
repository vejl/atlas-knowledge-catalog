"""Deterministic checks: the AI has no role in deciding whether these rows are valid."""
import csv
import io
import re
from collections import Counter
from datetime import date

MAX_BYTES = 2 * 1024 * 1024
COLUMNS = ("event_id", "title", "event_date", "capacity", "registered")


def check_csv(content: bytes):
    if len(content) > MAX_BYTES:
        raise ValueError("The file exceeds the 2 MB limit.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValueError("Save the file as UTF-8 CSV before uploading it.") from None
    if not text.strip():
        raise ValueError("The CSV file is empty.")
    try:
        dialect = csv.Sniffer().sniff(text[:8192], delimiters=",;")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ";" if ";" in text.splitlines()[0] else ","
    reader = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter, strict=True)
    issues = []

    def issue(row, column, message, severity="error"):
        issues.append(dict(row=row, column=column, message=message, severity=severity))

    try:
        header = next(reader)
        if len(header) != len(set(header)):
            raise ValueError("The header contains duplicate column names.")
        missing = [name for name in COLUMNS if name not in header]
        if missing:
            for name in missing:
                issue(1, name, "Required column is missing.")
            return result(0, delimiter, issues)
        seen, total = {}, 0
        for values in reader:
            row_number = reader.line_num  # physical line; the header is line 1
            if not values or all(not v.strip() for v in values):
                continue
            total += 1
            if len(values) != len(header):
                issue(row_number, "(row)", "Field count does not match the header.")
                continue
            row = {k: v.strip() for k, v in zip(header, values)}
            for name in COLUMNS:
                if not row[name]:
                    issue(row_number, name, "A value is required.")
            event_id = row["event_id"]
            if event_id:
                if event_id in seen:
                    issue(row_number, "event_id", f"Duplicate ID; first seen on line {seen[event_id]}.")
                else:
                    seen[event_id] = row_number
            raw_date = row["event_date"]
            if raw_date:
                try:
                    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date):
                        raise ValueError
                    date.fromisoformat(raw_date)
                except ValueError:
                    issue(row_number, "event_date", "Use a real calendar date in YYYY-MM-DD format.")
            numbers = {}
            for name in ("capacity", "registered"):
                if row[name]:
                    if not re.fullmatch(r"[0-9]+", row[name]) or len(row[name]) > 12:
                        issue(row_number, name, "Use a non-negative whole number (at most 12 digits).")
                    else:
                        numbers[name] = int(row[name])
            if len(numbers) == 2 and numbers["registered"] > numbers["capacity"]:
                issue(row_number, "registered", "Registrations exceed the event capacity.", "warning")
    except csv.Error:
        raise ValueError(f"Malformed CSV near line {reader.line_num}; check quoting and delimiters.") from None
    return result(total, delimiter, issues)


def result(total, delimiter, issues):
    counts = Counter(item["severity"] for item in issues)
    return dict(rows=total, delimiter=delimiter, errors=counts["error"],
                warnings=counts["warning"], issues=issues)
