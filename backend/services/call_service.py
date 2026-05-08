import asyncio
import logging
from typing import TYPE_CHECKING

import numpy as np
import sounddevice as sd

from backend.config import SYSTEM_PROMPT
from backend.services.speech_service import SpeechService, SpeechTranscriptionError
from backend.services.tts_service import TTSService
from backend.services.claude_client import ClaudeClient
from backend.services.conversation_store import ConversationStore

if TYPE_CHECKING:
    from backend.services.wake_word_service import WakeWordService

logger = logging.getLogger(__name__)

EXIT_PHRASES = ("goodbye jarvis", "bye jarvis", "end call", "that's all", "thanks jarvis")
ERROR_RECOVERY_MESSAGE = "My apologies sir, I encountered a difficulty. Please continue."
FAREWELL_MESSAGE = "Until next time, sir."
PCM_SAMPLE_RATE = 16000


class CallService:
    def __init__(
        self,
        speech: SpeechService,
        tts: TTSService,
        claude: ClaudeClient,
        store: ConversationStore,
    ) -> None:
        self._speech  = speech
        self._tts     = tts
        self._claude  = claude
        self._store   = store
        self._loop: asyncio.AbstractEventLoop | None = None
        self._wake_word_service: "WakeWordService | None" = None

        self._active             = False
        self._active_conversation_id: str | None = None
        self._subscriber_queues: list[asyncio.Queue] = []

    # ── Configuration ─────────────────────────────────────────────────────────

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def set_wake_word_service(self, service: "WakeWordService") -> None:
        self._wake_word_service = service

    @property
    def is_active(self) -> bool:
        return self._active

    # ── Wake word bridge ──────────────────────────────────────────────────────

    def trigger_from_thread(self) -> None:
        """Called from the WakeWordService background thread."""
        if self._loop and not self._active:
            asyncio.run_coroutine_threadsafe(self.start_call(), self._loop)

    # ── Call lifecycle ────────────────────────────────────────────────────────

    async def start_call(self) -> None:
        if self._active:
            return
        self._active = True

        if self._wake_word_service:
            self._wake_word_service.stop()

        self._active_conversation_id = self._store.create_conversation("Voice Call")
        logger.info(f"[Call] Call started — conversation {self._active_conversation_id}")

        await self._broadcast({"type": "call_started", "conversationId": self._active_conversation_id})
        asyncio.create_task(self._run_conversation_loop())

    async def end_call(self) -> None:
        if not self._active:
            return
        self._active = False
        self._active_conversation_id = None
        logger.info("[Call] Call ended")

        await self._broadcast({"type": "call_ended"})

        if self._wake_word_service:
            self._wake_word_service.start()

    # ── SSE subscriptions ─────────────────────────────────────────────────────

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscriber_queues.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        if queue in self._subscriber_queues:
            self._subscriber_queues.remove(queue)

    # ── Conversation loop ─────────────────────────────────────────────────────

    async def _run_conversation_loop(self) -> None:
        while self._active:
            await self._broadcast({"type": "state", "value": "listening"})

            try:
                transcript = await self._speech.listen()
            except SpeechTranscriptionError:
                logger.info("[Call] Silence timeout — ending call")
                await self.end_call()
                return

            if self._is_exit_command(transcript):
                await self._broadcast({"type": "message", "role": "user", "text": transcript})
                await self._broadcast({"type": "state", "value": "speaking"})
                await self._speak_and_broadcast(FAREWELL_MESSAGE)
                await self.end_call()
                return

            await self._broadcast({"type": "message", "role": "user", "text": transcript})
            await self._broadcast({"type": "state", "value": "thinking"})

            try:
                full_reply = await self._get_claude_reply(transcript)
            except Exception as error:
                logger.error(f"[Call] Claude error: {error}")
                await self._broadcast({"type": "state", "value": "speaking"})
                await self._speak_and_broadcast(ERROR_RECOVERY_MESSAGE)
                continue

            await self._broadcast({"type": "state", "value": "speaking"})
            await self._speak_and_broadcast(full_reply)

    async def _get_claude_reply(self, transcript: str) -> str:
        self._store.add_message(self._active_conversation_id, "user", transcript)
        history = self._store.get_messages(self._active_conversation_id)

        reply_chunks: list[str] = []
        async for chunk in self._claude.stream(history, SYSTEM_PROMPT):
            reply_chunks.append(chunk)

        full_reply = "".join(reply_chunks)
        self._store.add_message(self._active_conversation_id, "assistant", full_reply)
        return full_reply

    async def _speak_and_broadcast(self, text: str) -> None:
        await self._broadcast({"type": "message", "role": "assistant", "text": text})
        await self._speak(text)

    async def _speak(self, text: str) -> None:
        if not self._tts.is_configured:
            return
        try:
            pcm_bytes = await self._tts.synthesize_pcm(text)
            await asyncio.get_running_loop().run_in_executor(
                None, self._play_pcm_blocking, pcm_bytes
            )
        except Exception as error:
            logger.error(f"[Call] TTS error: {error}")

    def _play_pcm_blocking(self, pcm_bytes: bytes) -> None:
        audio_array = np.frombuffer(pcm_bytes, dtype=np.int16)
        sd.play(audio_array, samplerate=PCM_SAMPLE_RATE)
        sd.wait()

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _broadcast(self, event: dict) -> None:
        for queue in self._subscriber_queues:
            await queue.put(event)

    @staticmethod
    def _is_exit_command(transcript: str) -> bool:
        transcript_lower = transcript.lower()
        return any(phrase in transcript_lower for phrase in EXIT_PHRASES)
