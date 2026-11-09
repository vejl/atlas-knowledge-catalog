"""HTTP endpoints: validate input, call one service, return a clear result."""
from contextlib import asynccontextmanager
from pathlib import Path
import sqlite3

from fastapi import FastAPI, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import ai, db
from .config import ROOT, read_settings
from .csv_check import MAX_BYTES, check_csv
from .models import AIRequest, Confirmation, RelationInput, ResourceInput


def create_app(settings=None, ai_transport=None):
    settings = settings or read_settings()

    @asynccontextmanager
    async def lifespan(app):
        db.initialize(settings.database)
        yield

    app = FastAPI(title="Atlas API", version="1.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])

    @app.middleware("http")
    async def local_browser_requests(request: Request, call_next):
        # Local-only app: prevent other websites from making state-changing browser requests.
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if origin and origin != str(request.base_url).rstrip("/"):
                return JSONResponse({"detail": "Cross-origin requests are not allowed."}, status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        )
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        # Browser pages get an HTML recovery screen; API callers keep their JSON contract.
        path = request.url.path
        if (exc.status_code == 404 and request.method in {"GET", "HEAD"}
                and path != "/api" and not path.startswith(("/api/", "/static/", "/samples/"))):
            return FileResponse(ROOT / "static" / "not-found.html", status_code=404)
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(LookupError)
    async def not_found(request, exc):
        return JSONResponse({"detail": "Resource not found."}, status_code=404)

    @app.exception_handler(ValueError)
    async def bad_value(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.exception_handler(sqlite3.IntegrityError)
    async def bad_relation(request, exc):
        return JSONResponse({"detail": "The change violates a database constraint."}, status_code=409)

    @app.exception_handler(ai.AIError)
    async def ai_error(request, exc):
        return JSONResponse({"detail": exc.message}, status_code=exc.status)

    @app.get("/api/status")
    def status():
        with db.connect(settings.database) as conn:
            total = conn.execute("SELECT count(*) FROM resources").fetchone()[0]
            links = conn.execute("SELECT count(*) FROM relations").fetchone()[0]
        return dict(resources=total, relations=links, ai_configured=bool(settings.ai_api_key),
                    model=settings.ai_model, version="1.0.0")

    @app.get("/api/resources")
    def resources(q: str = Query("", max_length=180), type: str = "", tag: str = ""):
        with db.connect(settings.database) as conn:
            return db.list_resources(conn, q, type, tag)

    @app.get("/api/tags")
    def tags():
        with db.connect(settings.database) as conn:
            return [r[0] for r in conn.execute(
                "SELECT DISTINCT t.name FROM tags t JOIN resource_tags rt ON rt.tag_id=t.id ORDER BY t.name")]

    @app.get("/api/resources/{resource_id}")
    def detail(resource_id: int):
        with db.connect(settings.database) as conn:
            item = db.get_resource(conn, resource_id)
            item["relations"] = db.resource_relations(conn, resource_id)
            return item

    @app.post("/api/resources", status_code=201)
    def create(item: ResourceInput):
        with db.connect(settings.database) as conn:
            resource_id = db.insert_resource(conn, item)
            return db.get_resource(conn, resource_id)

    @app.put("/api/resources/{resource_id}")
    def update(resource_id: int, item: ResourceInput):
        with db.connect(settings.database) as conn:
            db.update_resource(conn, resource_id, item)
            return db.get_resource(conn, resource_id)

    @app.post("/api/resources/{resource_id}/relations", status_code=201)
    def link(resource_id: int, relation: RelationInput):
        with db.connect(settings.database) as conn:
            db.add_relation(conn, resource_id, relation.target_id, relation.kind)
            return {"saved": True}

    @app.post("/api/csv/check")
    async def validate_csv(file: UploadFile):
        content = await file.read(MAX_BYTES + 1)
        await file.close()
        if len(content) > MAX_BYTES:
            raise HTTPException(413, "The file exceeds the 2 MB limit.")
        return check_csv(content)

    @app.post("/api/ai/proposals")
    async def proposals(item: AIRequest):
        if not item.text.strip():
            raise HTTPException(422, "Enter a request or source text.")
        with db.connect(settings.database) as conn:
            catalogue = db.list_resources(conn)
        result = await ai.propose(settings, item.text, catalogue, ai_transport)
        payload = result.model_dump(mode="json")
        with db.connect(settings.database) as conn:
            for record in payload["records"]:
                record["duplicates"] = db.duplicates(conn, record["title"])
        return payload

    @app.post("/api/ai/confirm", status_code=201)
    def confirm(item: Confirmation):
        with db.connect(settings.database) as conn:
            ids = db.confirm_batch(conn, item.request_id, item.records)
            return {"resource_ids": ids}

    @app.get("/samples/{filename}")
    def sample(filename: str):
        allowed = {"events-valid.csv", "events-errors.csv", "events-semicolon.csv", "ai-source.txt"}
        if filename not in allowed:
            raise HTTPException(404, "Sample not found.")
        return FileResponse(ROOT / "samples" / filename, filename=filename)

    app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")

    @app.get("/", include_in_schema=False)
    def home():
        return FileResponse(ROOT / "static" / "index.html")

    return app


app = create_app()
