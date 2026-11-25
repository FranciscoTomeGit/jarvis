import asyncio
import io
import logging
import queue
import wave
import numpy as np
import sounddevice as sd

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000
CHUNK_DURATION_SECONDS = 0.1
SILENCE_THRESHOLD_RMS = 300
SILENCE_CUTOFF_SECONDS = 2.0
MAX_RECORDING_DURATION_SECONDS = 30


class SpeechTranscriptionError(Exception):
    pass


class SpeechService:
    def __init__(self, engine: str = "google", whisper_model: str = "large-v3-turbo",
                 whisper_device: str = "auto", language: str = "en") -> None:
        self._language = language
        self._whisper = None
        if engine.strip().lower() == "whisper":
            try:
                from backend.services.whisper_transcriber import WhisperTranscriber
                self._whisper = WhisperTranscriber(whisper_model, whisper_device, language)
            except ImportError:
                logger.warning("[Speech] faster-whisper not installed — falling back to Google speech recognition")
        try:
            device_info = sd.query_devices(kind='input')
            logger.info(f"[Speech] Default input device: {device_info['name']}")
        except Exception as error:
            logger.warning(f"[Speech] Could not query default device: {error}")

    def warm_up(self) -> None:
        """Load the local speech model ahead of time (blocking — run in a thread)."""
        if self._whisper:
            try:
                self._whisper.load()
            except Exception as error:
                logger.error(f"[Speech] {error} — falling back to Google speech recognition")
                self._whisper = None

    @staticmethod
    def list_devices() -> list[dict]:
        seen: set[str] = set()
        result: list[dict] = []
        for device_index, device in enumerate(sd.query_devices()):
            if device["max_input_channels"] > 0:
                name: str = device["name"].strip()
                if name not in seen:
                    seen.add(name)
                    result.append({"index": device_index, "name": name})
        return result

    async def listen(self, device: int | None = None) -> str:
        return await asyncio.get_running_loop().run_in_executor(
            None, self._listen_blocking, device
        )

    def _listen_blocking(self, device: int | None = None) -> str:
        audio_data = self._record_until_silence(device)
        return self._transcribe(audio_data)

    def _record_until_silence(self, device: int | None = None) -> np.ndarray:
        """Record from one continuous input stream (no gaps between chunks) until silence."""
        chunk_samples = int(SAMPLE_RATE * CHUNK_DURATION_SECONDS)
        silence_chunks_needed = int(SILENCE_CUTOFF_SECONDS / CHUNK_DURATION_SECONDS)
        max_chunks = int(MAX_RECORDING_DURATION_SECONDS / CHUNK_DURATION_SECONDS)

        chunks: list[np.ndarray] = []
        consecutive_silence_chunks = 0
        speech_has_started = False
        audio_queue: queue.Queue[np.ndarray] = queue.Queue()

        def on_audio(indata, frames, time_info, status):
            if status:
                logger.warning(f"[Speech] Stream status: {status}")
            audio_queue.put(indata.copy())

        device_info = sd.query_devices(device=device, kind='input')
        logger.info(f"[Speech] Listening on: {device_info['name']}")

        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype='int16',
                            blocksize=chunk_samples, device=device, callback=on_audio):
            for _ in range(max_chunks):
                chunk = audio_queue.get(timeout=5)
                chunks.append(chunk)

                is_silent = self._compute_rms(chunk) < SILENCE_THRESHOLD_RMS
                if not is_silent:
                    speech_has_started = True
                    consecutive_silence_chunks = 0
                elif speech_has_started:
                    consecutive_silence_chunks += 1
                    if consecutive_silence_chunks >= silence_chunks_needed:
                        logger.info("[Speech] Silence cutoff reached — stopping recording.")
                        break

        if not speech_has_started:
            raise SpeechTranscriptionError("No speech detected — please try again.")

        return np.concatenate(chunks, axis=0)

    @staticmethod
    def _compute_rms(chunk: np.ndarray) -> int:
        return int(np.sqrt(np.mean(chunk.astype(np.float32) ** 2)))

    def _encode_as_wav(self, audio_data: np.ndarray) -> io.BytesIO:
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_writer:
            wav_writer.setnchannels(1)
            wav_writer.setsampwidth(2)
            wav_writer.setframerate(SAMPLE_RATE)
            wav_writer.writeframes(audio_data.tobytes())
        wav_buffer.seek(0)
        return wav_buffer

    def _transcribe(self, audio_data: np.ndarray) -> str:
        if self._whisper:
            try:
                text = self._whisper.transcribe(audio_data)
            except Exception as error:
                raise SpeechTranscriptionError(f"Local speech recognition failed: {error}")
        else:
            text = self._transcribe_with_google(audio_data)
        if not text:
            raise SpeechTranscriptionError("Could not understand audio — please try again.")
        logger.info(f"[Speech] Transcribed: '{text}'")
        return text

    def _transcribe_with_google(self, audio_data: np.ndarray) -> str:
        import speech_recognition as sr
        recognizer = sr.Recognizer()
        google_language = {"en": "en-US", "pt": "pt-PT"}.get(self._language, "en-US")
        try:
            with sr.AudioFile(self._encode_as_wav(audio_data)) as source:
                audio = recognizer.record(source)
            return recognizer.recognize_google(audio, language=google_language)
        except sr.UnknownValueError:
            return ""
        except sr.RequestError as error:
            raise SpeechTranscriptionError(f"Speech service unavailable: {error}")
