import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.api.models import ChatRequest, ConversationCreate, ConversationRename, SpeechListenRequest
from backend.config import settings, SYSTEM_PROMPT
from backend.services.gemini_client import ClaudeClient
from backend.services.conversation_store import ConversationStore
from backend.services.speech_service import SpeechService, SpeechTranscriptionError

router = APIRouter(prefix="/api")

store = ConversationStore()
claude = ClaudeClient(
    api_key=settings.anthropic_api_key,
    model=settings.model,
    max_tokens=settings.max_tokens,
)
speech = SpeechService()


@router.post("/conversations", status_code=201)
def create_conversation(body: ConversationCreate):
    conv_id = store.create_conversation(body.title)
    return {"id": conv_id, "title": body.title}


@router.get("/conversations")
def list_conversations():
    return store.list_conversations()


@router.patch("/conversations/{conv_id}")
def rename_conversation(conv_id: str, body: ConversationRename):
    if not store.conversation_exists(conv_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    store.rename_conversation(conv_id, body.title)
    return {"ok": True}


@router.delete("/conversations/{conv_id}", status_code=204)
def delete_conversation(conv_id: str):
    if not store.conversation_exists(conv_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    store.delete_conversation(conv_id)


@router.get("/conversations/{conv_id}/messages")
def get_messages(conv_id: str):
    if not store.conversation_exists(conv_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return store.get_messages(conv_id)


@router.post("/conversations/{conv_id}/chat")
async def chat(conv_id: str, body: ChatRequest):
    if not store.conversation_exists(conv_id):
        raise HTTPException(status_code=404, detail="Conversation not found")

    user_content = body.message
    if body.context.strip():
        user_content = f"[CODE CONTEXT]\n```\n{body.context.strip()}\n```\n\n[QUESTION]\n{body.message}"

    store.add_message(conv_id, "user", user_content)
    history = store.get_messages(conv_id)

    async def generate():
        full_reply = ""
        try:
            async for chunk in claude.stream(history, SYSTEM_PROMPT):
                full_reply += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'error': True})}\n\n"
        finally:
            if full_reply:
                store.add_message(conv_id, "assistant", full_reply)
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
    except SpeechTranscriptionError as e:
        raise HTTPException(status_code=422, detail=str(e))
