import asyncio
import io
import logging
import wave
import numpy as np
import sounddevice as sd
import speech_recognition as sr

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000
CHUNK_DURATION_SECONDS = 0.3
SILENCE_THRESHOLD_RMS = 300
SILENCE_CUTOFF_SECONDS = 1.5
MAX_RECORDING_DURATION_SECONDS = 30


class SpeechTranscriptionError(Exception):
    pass


class SpeechService:
    def __init__(self) -> None:
        self._recognizer = sr.Recognizer()
        try:
            device_info = sd.query_devices(kind='input')
            logger.info(f"[Speech] Default input device: {device_info['name']}")
        except Exception as error:
            logger.warning(f"[Speech] Could not query default device: {error}")

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
        chunk_samples = int(SAMPLE_RATE * CHUNK_DURATION_SECONDS)
        silence_chunks_needed = int(SILENCE_CUTOFF_SECONDS / CHUNK_DURATION_SECONDS)
        max_chunks = int(MAX_RECORDING_DURATION_SECONDS / CHUNK_DURATION_SECONDS)

        chunks: list[np.ndarray] = []
        consecutive_silence_chunks = 0
        speech_has_started = False

        device_info = sd.query_devices(device=device, kind='input')
        logger.info(f"[Speech] Listening on: {device_info['name']}")

        for chunk_index in range(max_chunks):
            chunk = sd.rec(
                chunk_samples,
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype='int16',
                device=device,
            )
            sd.wait()
            chunks.append(chunk)

            rms = self._compute_rms(chunk)
            is_silent = rms < SILENCE_THRESHOLD_RMS
            logger.info(f"[Speech] Chunk {chunk_index + 1:02d} | RMS={rms:5d} | {'silent' if is_silent else 'SPEECH'}")

            if not is_silent:
                speech_has_started = True
                consecutive_silence_chunks = 0
            elif speech_has_started:
                consecutive_silence_chunks += 1
                logger.info(f"[Speech] Silence {consecutive_silence_chunks}/{silence_chunks_needed}")
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
        wav_buffer = self._encode_as_wav(audio_data)
        logger.info(f"[Speech] Sending {len(audio_data)} samples for transcription...")
        try:
            with sr.AudioFile(wav_buffer) as source:
                audio = self._recognizer.record(source)
            text = self._recognizer.recognize_google(audio)
            logger.info(f"[Speech] Transcribed: '{text}'")
            return text
        except sr.UnknownValueError:
            raise SpeechTranscriptionError("Could not understand audio — please try again.")
        except sr.RequestError as error:
            raise SpeechTranscriptionError(f"Speech service unavailable: {error}")
