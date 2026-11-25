import asyncio
import logging
from fastapi import FastAPI

logging.basicConfig(level=logging.INFO, format="%(message)s")
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database import init_db
from backend.api.routes import router, call_service, wake_word_service, speech
from backend.config import settings
from backend.services import ollama_process

app = FastAPI(title="Jarvis")

app.include_router(router)

app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.on_event("startup")
async def startup():
    init_db()
    if settings.llm_provider.strip().lower() == "ollama":
        await asyncio.to_thread(ollama_process.start, settings.ollama_base_url)
    # Load the speech model in the background so startup isn't delayed
    asyncio.get_running_loop().run_in_executor(None, speech.warm_up)
    call_service.set_loop(asyncio.get_running_loop())
    if wake_word_service:
        wake_word_service.start()


@app.on_event("shutdown")
def shutdown():
    ollama_process.stop()


@app.get("/")
def index():
    return FileResponse("frontend/index.html")
