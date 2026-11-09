# Cloudflare Pages

The browser demo is a static site hosted directly on Cloudflare Pages. The full Python application remains available as a source ZIP from the demo's download button.

## Prepare locally

```powershell
python scripts/build_demo.py
```

This generates `web/atlas-demo/dist`, including synthetic sample data, local font assets, the custom `404.html`, security headers and the source download. No local database, API key or personal notes are included.

## Deployment

Use Wrangler with the intended Cloudflare account. Verify the authenticated identity and account before creating a **new** Pages project. Existing websites do not need to be modified. After the project is created, confirm its actual `pages.dev` address and obtain explicit approval for uploading and publishing there.

If a new project's creation is automatically delegated to Workers, `pages project create ... --force` selects direct Pages creation instead. This flag is needed only for initial creation; do not add it to later deployment commands.

From `web/atlas-demo`, the deployment command is:

```powershell
npx wrangler pages deploy dist --project-name atlas-catalog-vejl --branch main
```

Running this command publishes a website. Do not run it without the owner's approval. GitHub publication is a separate action.

Cloudflare supports [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) with Wrangler or a directory/ZIP in the dashboard. A Direct Upload project cannot later be converted to Git integration; GitHub Actions can still run the same Wrangler command after an approved source push, or a separate Git-integrated Pages project can be created later.

The public demo uses browser storage per visitor and prepared AI scenarios. No live catalogue AI endpoint or shared SQLite database is exposed. The downloaded full app uses Python, FastAPI, SQLite and the operator's own configured AI service.
