# Verification

## Automated checks

Verified locally on Windows with Python 3.14 and Node.js:

- **36 Python tests:** catalogue CRUD and persistence, SQL search/filtering, relation constraints, CSV fixtures and error locations, proposal/confirmation separation, rollback, retries, provider failures and custom HTTP error pages.
- **19 frontend tests:** browser-demo persistence/isolation, validation and atomic saves; CSV BOM, delimiter, quoting and physical-line handling; dictation events and bounded undo/redo history.
- JavaScript syntax checks passed. The GitHub Actions workflow runs both suites on Linux; its current result is available in the repository's Actions tab.

AI tests with MockTransport check application behaviour for supplied responses. They do not establish the behaviour of a live model.

## Live model checks

The configured CERIT-SC `mini` alias was tested separately. Eight synthetic language/date/scope cases passed: Slovak, Czech, missing diacritics, spoken dates, separate review/event dates, an unknown review date, ambiguity and an off-topic request. A safe result summary is in `metadata-verification.json`. Full provider outputs and credentials are excluded from distribution.

A live browser request placed `2026-12-12` into Reviewed while preserving the supplied Slovak title, owner and description. Earlier live checks also exercised proposal review, an approved save, relationships and a recipe refusal. These are observations for particular inputs and the selected provider, not universal guarantees.

## Browser and deployment checks

Catalogue search, detail, edit, relationships, required fields, malformed URLs, empty AI requests, the custom CSV button and field guidance were exercised. A real microphone transcription was confirmed in Chrome. Speech activity and pause/resume edge cases use simulated events in automated tests; the wave represents recognition activity, not measured audio volume.

The public browser demo runs on Cloudflare Pages. Its catalogue changes stay in the visitor's browser and its AI scenarios are explicitly prepared examples. Browser checks exercised creation/persistence, reset, draft approval, a prepared refusal and CSV results of 5 errors and 1 warning.

Production verification checked HTTPS, HTML security headers, a real 404 response, 12 synthetic seed resources, absence of a live API route and a downloadable ZIP whose checksum matched the approved upload. The archive excludes credentials, live databases, logs and personal notes.

## Limits

The full Python app is local and single-user. Other providers, accounts, models and microphone services need their own live checks. The test environment emits an upstream Starlette TestClient deprecation notice; it does not fail the suite. Browser and operating-system permission/file-picker dialogs retain their native UI.
