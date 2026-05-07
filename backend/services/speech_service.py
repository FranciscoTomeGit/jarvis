import asyncio
import io
import logging
import wave
import numpy as np
import sounddevice as sd
import speech_recognition as sr

log = logging.getLogger(__name__)

SAMPLE_RATE = 16000
CHUNK_DURATION = 0.3        # seconds per chunk
SILENCE_THRESHOLD = 300     # RMS amplitude below this = silence
SILENCE_CUTOFF = 1.5        # seconds of silence before stopping
MAX_DURATION = 30           # safety cap in seconds


class SpeechTranscriptionError(Exception):
    pass


class SpeechService:
    def __init__(self) -> None:
        self._recognizer = sr.Recognizer()
        try:
            device_info = sd.query_devices(kind='input')
            log.info(f"[Speech] Default input device: {device_info['name']}")
        except Exception as e:
            log.warning(f"[Speech] Could not query default device: {e}")

    @staticmethod
    def list_devices() -> list[dict]:
        seen: set[str] = set()
        result: list[dict] = []
        for i, d in enumerate(sd.query_devices()):
            if d["max_input_channels"] > 0:
                name: str = d["name"].strip()
                if name not in seen:
                    seen.add(name)
                    result.append({"index": i, "name": name})
        return result

    async def listen(self, device: int | None = None) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._listen_blocking, device)

    def _listen_blocking(self, device: int | None = None) -> str:
        audio_data = self._record_until_silence(device)
        return self._transcribe(audio_data)

    def _record_until_silence(self, device: int | None = None) -> np.ndarray:
        chunk_samples = int(SAMPLE_RATE * CHUNK_DURATION)
        silence_chunks_needed = int(SILENCE_CUTOFF / CHUNK_DURATION)
        max_chunks = int(MAX_DURATION / CHUNK_DURATION)

        chunks: list[np.ndarray] = []
        silence_count = 0
        speech_started = False

        device_info = sd.query_devices(device=device, kind='input')
        log.info(f"[Speech] Listening on: {device_info['name']}")

        for i in range(max_chunks):
            chunk = sd.rec(
                chunk_samples,
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype='int16',
                device=device,
            )
            sd.wait()
            chunks.append(chunk)

            rms = int(np.sqrt(np.mean(chunk.astype(np.float32) ** 2)))
            is_silent = rms < SILENCE_THRESHOLD
            status = "silent" if is_silent else "SPEECH"
            log.info(f"[Speech] Chunk {i+1:02d} | RMS={rms:5d} | {status}")

            if not is_silent:
                speech_started = True
                silence_count = 0
            elif speech_started:
                silence_count += 1
                log.info(f"[Speech] Silence {silence_count}/{silence_chunks_needed}")
                if silence_count >= silence_chunks_needed:
                    log.info("[Speech] Silence cutoff reached — stopping recording.")
                    break

        if not speech_started:
            raise SpeechTranscriptionError("No speech detected — please try again.")

        log.info(f"[Speech] Recorded {len(chunks)} chunks, sending to Google...")
        return np.concatenate(chunks, axis=0)

    def _transcribe(self, audio_data: np.ndarray) -> str:
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(audio_data.tobytes())
        buf.seek(0)

        try:
            with sr.AudioFile(buf) as source:
                audio = self._recognizer.record(source)
            text = self._recognizer.recognize_google(audio)
            log.info(f"[Speech] Transcribed: '{text}'")
            return text
        except sr.UnknownValueError:
            raise SpeechTranscriptionError("Could not understand audio — please try again.")
        except sr.RequestError as e:
            raise SpeechTranscriptionError(f"Speech service unavailable: {e}")
