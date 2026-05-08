import asyncio
import json
import logging
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from backend.api.models import ChatRequest, ConversationCreate, ConversationRename, SpeechListenRequest, SynthesisRequest
from backend.config import settings, SYSTEM_PROMPT
from backend.services.claude_client import ClaudeClient
from backend.services.conversation_store import ConversationStore
from backend.services.speech_service import SpeechService, SpeechTranscriptionError
from backend.services.tts_service import TTSService
from backend.services.call_service import CallService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

store = ConversationStore()
claude = ClaudeClient(
    api_key=settings.anthropic_api_key,
    model=settings.model,
    max_tokens=settings.max_tokens,
)
speech = SpeechService()
tts    = TTSService(
    api_key=settings.elevenlabs_api_key,
    voice_id=settings.elevenlabs_voice_id,
)
call_service = CallService(speech=speech, tts=tts, claude=claude, store=store)

wake_word_service = None
if settings.picovoice_access_key:
    try:
        from backend.services.wake_word_service import WakeWordService
        wake_word_service = WakeWordService(
            access_key=settings.picovoice_access_key,
            on_wake=call_service.trigger_from_thread,
        )
        call_service.set_wake_word_service(wake_word_service)
    except ImportError:
        logger.warning("[WakeWord] pvporcupine not installed — wake word disabled")


def _require_conversation(conversation_id: str) -> None:
    if not store.conversation_exists(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")


def _build_user_content(message: str, context: str) -> str:
    if context.strip():
        return f"[CODE CONTEXT]\n```\n{context.strip()}\n```\n\n[QUESTION]\n{message}"
    return message


@router.post("/conversations", status_code=201)
def create_conversation(body: ConversationCreate):
    conversation_id = store.create_conversation(body.title)
    return {"id": conversation_id, "title": body.title}


@router.get("/conversations")
def list_conversations():
    return store.list_conversations()


@router.patch("/conversations/{conversation_id}")
def rename_conversation(conversation_id: str, body: ConversationRename):
    if not store.rename_conversation(conversation_id, body.title):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True}


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str):
    if not store.delete_conversation(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.get("/conversations/{conversation_id}/messages")
def get_messages(conversation_id: str):
    _require_conversation(conversation_id)
    return store.get_messages(conversation_id)


@router.post("/conversations/{conversation_id}/chat")
async def chat(conversation_id: str, body: ChatRequest):
    _require_conversation(conversation_id)

    user_content = _build_user_content(body.message, body.context)
    store.add_message(conversation_id, "user", user_content)
    history = store.get_messages(conversation_id)

    async def generate():
        reply_chunks: list[str] = []
        try:
            async for chunk in claude.stream(history, SYSTEM_PROMPT):
                reply_chunks.append(chunk)
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'error': True})}\n\n"
        finally:
            full_reply = "".join(reply_chunks)
            if full_reply:
                store.add_message(conversation_id, "assistant", full_reply)
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/speech/devices")
def speech_devices():
    return speech.list_devices()


@router.post("/speech/listen")
async def speech_listen(body: SpeechListenRequest = SpeechListenRequest()):
    try:
        text = await speech.listen(device=body.device)
        return {"text": text}
    except SpeechTranscriptionError as error:
        raise HTTPException(status_code=422, detail=str(error))


@router.post("/speech/synthesize")
async def synthesize_speech(body: SynthesisRequest):
    if not tts.is_configured:
        raise HTTPException(status_code=503, detail="ElevenLabs not configured — add ELEVENLABS_API_KEY to .env")
    try:
        audio_bytes = await tts.synthesize(body.text)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"TTS service error: {error}")


@router.get("/call/events")
async def call_events(request: Request):
    queue = call_service.subscribe()

    async def event_stream():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield "data: {\"type\":\"ping\"}\n\n"
        finally:
            call_service.unsubscribe(queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/call/start")
async def start_call():
    await call_service.start_call()
    return {"ok": True}


@router.post("/call/end")
async def end_call():
    await call_service.end_call()
    return {"ok": True}
