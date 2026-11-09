"""Live language/date checks using synthetic requests only; never writes catalogue records."""
import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from atlas.ai import AIError, propose
from atlas.config import ROOT, read_settings

CASES = [
    dict(name="slovak_review", text="Vytvor dokument. Názov je Ranný meeting. Owner je Jana Kováčová. Review nastav na 12. decembra 2026. Popis je Zápis z porady.", title="Ranný meeting", reviewed_on="2026-12-12", owner="Jana Kováčová"),
    dict(name="spoken_date", text="Pridaj dokument s názvom Návod pre dobrovoľníkov. Dátum poslednej kontroly je dvanásteho decembra dvetisíc dvadsaťšesť. Vlastník je Peter Novák.", title="Návod pre dobrovoľníkov", reviewed_on="2026-12-12", owner="Peter Novák"),
    dict(name="without_diacritics", text="Vytvor dokument s nazvom Manual registracie. Vlastnik je Jana Kovacova. Datum poslednej kontroly nastav na 5. 11. 2026.", title="Manual registracie", reviewed_on="2026-11-05", owner="Jana Kovacova"),
    dict(name="czech_review", text="Přidej dokument s názvem Pravidla workshopu. Poslední revize proběhla 6. listopadu 2026. Vlastník je Eva Nováková.", title="Pravidla workshopu", reviewed_on="2026-11-06", owner="Eva Nováková"),
    dict(name="two_different_dates", text="Pridaj dokument s názvom Program workshopu. Workshop sa koná 12. decembra 2026. Dátum poslednej kontroly dokumentu je 1. novembra 2026.", title="Program workshopu", reviewed_on="2026-11-01", description_date=True),
    dict(name="event_date_only", text="Pridaj dokument s názvom Program workshopu. Workshop sa koná 12. decembra 2026. Dátum kontroly dokumentu nepoznám.", title="Program workshopu", reviewed_on=None, description_date=True),
    dict(name="ambiguous_date", text="Vytvor dokument s názvom Zápis. Dátum dokumentu je 12. decembra 2026.", kind="answer"),
    dict(name="scope_refusal", text="Daj mi recept na palacinky.", kind="refusal"),
]


def assess(case, result):
    kind = case.get("kind", "proposal")
    if result.kind != kind:
        return False
    if kind != "proposal":
        return not result.records
    if len(result.records) != 1:
        return False
    record = result.records[0]
    review = record.reviewed_on.isoformat() if record.reviewed_on else None
    ok = record.title == case["title"] and review == case["reviewed_on"]
    if "owner" in case:
        ok = ok and record.owner == case["owner"]
    if case.get("description_date"):
        # Accept the original phrase or normalised date, without losing the event fact.
        ok = ok and "2026" in record.description and "12" in record.description
    return bool(ok)


async def main():
    settings = read_settings()
    checks = []
    for case in CASES:
        print("Running " + case["name"], flush=True)
        try:
            result = await propose(settings, case["text"], [])
            passed = assess(case, result)
            checks.append(dict(case=case["name"], passed=passed, result=result.model_dump(mode="json")))
        except AIError as exc:
            checks.append(dict(case=case["name"], passed=False, error=exc.message))
        print("  " + ("PASS" if checks[-1]["passed"] else "FAIL"), flush=True)
    report = dict(checked_at=datetime.now(timezone.utc).isoformat(), model=settings.ai_model,
                  checks=checks, note="Synthetic cases only, no database writes. A small sample is not a universal guarantee.")
    path = ROOT / "data" / "metadata-check.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Report: data/metadata-check.json ({sum(c['passed'] for c in checks)}/{len(checks)} passed)")
    return 0 if all(c["passed"] for c in checks) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
