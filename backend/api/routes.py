import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.api.models import ChatRequest, ConversationCreate, ConversationRename, SpeechListenRequest
from backend.config import settings, SYSTEM_PROMPT
from backend.services.claude_client import ClaudeClient
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
