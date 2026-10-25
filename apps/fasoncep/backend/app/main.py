from __future__ import annotations

import json
import asyncio
from contextlib import suppress
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .settings import is_production, allowed_hosts, frontend_directory, site_mode
from .seo import router as seo_router, render_page, public_url
from .demo_requests import router as demo_router, initialize_requests, cleanup_requests
from fastapi.exceptions import RequestValidationError
from urllib.parse import urlsplit
from .auth import current_user, assert_owner, router as auth_router

from .database import connection, initialize_db
from .schemas import WorkshopInput, WorkshopResponse


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_db()
    initialize_requests()
    async def purge_loop():
        while True:
            await asyncio.sleep(3600)
            await asyncio.to_thread(cleanup_requests)
    cleanup_task = asyncio.create_task(purge_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task


app = FastAPI(
    title="FasonCep API",
    description="FasonCep atölye iş takibi API.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None if is_production() else "/api/openapi.json",
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "production" if is_production() else "local"}


def as_workshop(row) -> WorkshopResponse:
    return WorkshopResponse(
        id=row["id"],
        name=row["name"],
        work_types=json.loads(row["work_types_json"]),
        employee_band=row["employee_band"],
        phone=row["phone"],
        email=row["email"],
        address=row["address"],
        description=row["description"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.get("/api/workshops", response_model=list[WorkshopResponse])
def list_workshops(user=Depends(current_user)):
    with connection() as db:
        rows = db.execute("SELECT * FROM workshops WHERE owner_id=? ORDER BY id", (user["id"],)).fetchall()
    return [as_workshop(row) for row in rows]


def workshop_values(payload: WorkshopInput):
    return (payload.name, json.dumps(payload.work_types, ensure_ascii=False),
            payload.employee_band, payload.phone, payload.email, payload.address, payload.description)


@app.post("/api/workshops", response_model=WorkshopResponse, status_code=201)
def create_workshop(payload: WorkshopInput, user=Depends(current_user)):
    with connection() as db:
        cursor = db.execute(
            "INSERT INTO workshops (name, work_types_json, employee_band, phone, email, address, description, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (*workshop_values(payload), user["id"]),
        )
        row = db.execute("SELECT * FROM workshops WHERE id=?", (cursor.lastrowid,)).fetchone()
    return as_workshop(row)


@app.put("/api/workshops/{workshop_id}", response_model=WorkshopResponse)
def update_workshop(workshop_id: int, payload: WorkshopInput, user=Depends(current_user)):
    with connection() as db:
        assert_owner(db, workshop_id, user["id"])
        cursor = db.execute(
            """UPDATE workshops SET name=?, work_types_json=?, employee_band=?, phone=?, email=?, address=?,
               description=?, updated_at=datetime('now') WHERE id=?""",
            (*workshop_values(payload), workshop_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Atölye bulunamadı.")
        row = db.execute("SELECT * FROM workshops WHERE id=?", (workshop_id,)).fetchone()
    return as_workshop(row)


from .operations import router as operations_router
app.include_router(operations_router)

from .excel_export import router as excel_router
app.include_router(excel_router)


app.include_router(auth_router)


@app.middleware('http')
async def security_headers(request: Request, call_next):
    if site_mode() == 'marketing' and request.url.path.startswith('/api/') and request.url.path not in ('/api/health','/api/public-config','/api/demo-requests'):
        return JSONResponse({'detail':'Bu sayfa kullanıma açık değil.'}, status_code=404, headers={'X-Robots-Tag':'noindex, nofollow','Cache-Control':'no-store'})
    if request.method in ('POST','PUT','PATCH','DELETE'):
        origin = request.headers.get('origin')
        if origin:
            try:
                source=urlsplit(origin)
                allowed=source.scheme==request.url.scheme and source.netloc==request.url.netloc
            except ValueError:
                allowed=False
            if not allowed:
                return JSONResponse({'detail':'İstek kaynağı doğrulanamadı.'},status_code=403)
        elif 'application/json' not in request.headers.get('content-type','') and request.headers.get('x-fasoncep-request')!='1':
            return JSONResponse({'detail':'Geçersiz istek biçimi.'},status_code=403)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Referrer-Policy']='same-origin'
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control']='no-store'
        response.headers['X-Robots-Tag']='noindex, nofollow'
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Validation responses must never echo submitted passwords or other input values.
    return JSONResponse(status_code=422, content={'detail':[
        {'loc':error['loc'],'msg':error['msg'],'type':error['type']} for error in exc.errors()
    ]})


# Only explicit SPA routes are served. Unknown /api routes remain real JSON 404s.
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts())
public_url()  # Reject an invalid configured canonical origin at startup.
site_mode()
app.include_router(seo_router)
app.include_router(demo_router)
frontend=frontend_directory()
if is_production() and not (frontend/'index.html').is_file():
    raise RuntimeError('Üretim frontend derlemesi bulunamadı; önce npm run build çalıştırın.')
if (frontend/'index.html').is_file():
    app.mount('/assets', StaticFiles(directory=frontend/'assets'), name='assets')
    @app.get('/',include_in_schema=False)
    @app.get('/giris',include_in_schema=False)
    @app.get('/kayit',include_in_schema=False)
    @app.get('/uygulama',include_in_schema=False)
    @app.get('/demo',include_in_schema=False)
    @app.get('/demo-talebi',include_in_schema=False)
    @app.get('/aydinlatma',include_in_schema=False)
    def frontend_page(request: Request):
        if site_mode() == 'marketing' and request.url.path in ('/giris','/kayit','/uygulama'):
            from fastapi.responses import RedirectResponse
            return RedirectResponse('/demo' if request.url.path == '/uygulama' else '/demo-talebi', status_code=307, headers={'X-Robots-Tag':'noindex, nofollow'})
        return render_page(request.url.path)
