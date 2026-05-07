from pydantic import BaseModel


class ConversationCreate(BaseModel):
    title: str = "New Chat"


class ConversationRename(BaseModel):
    title: str


class ChatRequest(BaseModel):
    message: str
    context: str = ""

class SpeechListenRequest(BaseModel):
    device: int | None = None
