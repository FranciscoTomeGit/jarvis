from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database import init_db
from backend.api.routes import router

app = FastAPI(title="Jarvis")

app.include_router(router)

app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def index():
    return FileResponse("frontend/index.html")
