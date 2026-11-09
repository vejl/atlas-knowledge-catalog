# Three-minute demo

Before presenting: start Atlas, verify your own provider with `scripts/check_ai.py --live`, and keep the two sample CSVs ready. If the provider is unavailable, explain that limitation; demonstrate the catalogue and deterministic checks without claiming a live AI result.

## 0:00–0:35 — The problem

“A small event team has useful information spread across guides, tables and reports. Atlas gives each resource a description, owner and connections, so the next person can understand it.”

Search for `registration`. Open **Volunteer registration guide**. Show its metadata and the directed link to **Volunteer registrations**. Explain that catalogue metadata describes a source; it does not copy all rows from that source.

## 0:35–1:15 — Data quality

Open **CSV check**, upload `events-errors.csv` and show the five errors and one warning. Point to the duplicate ID on line 3 and the capacity warning on line 5. Explain why fixed rules produce these results without a model call. Optionally upload the valid sample.

## 1:15–2:15 — Reviewed AI assistance

Open **AI assistant**, use the example request and ask Atlas. Explain that only the request plus bounded catalogue context goes to the configured provider. Show the editable draft, missing URL and proposed connection. Change a field and save. Return to the catalogue to show the resource. No write occurred before approval.

Ask for a pancake recipe and show the refusal **if verified with the selected live model**. Explain that this is a basic prompt guardrail and that independent backend validation protects database operations.

## 2:15–3:00 — What I built and understand

“The backend uses Python, FastAPI, Pydantic and SQLite. The frontend is HTML, CSS and JavaScript. I used AI assistance during development and am working through the implementation. I can explain the relational model, CSV rules and the proposal/confirmation boundary.”

Show the data model and one meaningful test. Explain that the full application runs locally for a single user; the browser demo keeps each visitor's changes in their browser and uses prepared AI scenarios.

## Likely follow-up questions

- **Why SQLite?** A simple local setup with real SQL, constraints and transactions. A shared hosted service would need its own storage/deployment design.
- **Why a linking table for tags?** Many resources can share many tags without storing lists in text fields.
- **What if the model invents an ID?** Backend validation rejects the proposal; confirmation also checks existing targets.
- **What if half the batch fails?** The transaction rolls the whole batch back.
- **What does the recipe test prove?** One observed model behaviour for that input, not universal resistance to off-topic prompts or injection.
- **What did AI help with?** Code generation, examples and iteration. Describe only the parts you have actually reviewed and can explain.
