import asyncio
import logging
from fastapi import FastAPI

logging.basicConfig(level=logging.INFO, format="%(message)s")
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database import init_db
from backend.api.routes import router, call_service, wake_word_service

app = FastAPI(title="Jarvis")

app.include_router(router)

app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.on_event("startup")
async def startup():
    init_db()
    call_service.set_loop(asyncio.get_running_loop())
    if wake_word_service:
        wake_word_service.start()


@app.get("/")
def index():
    return FileResponse("frontend/index.html")
