import logging
import threading
from collections.abc import Callable

import pvporcupine
import sounddevice as sd

logger = logging.getLogger(__name__)


class WakeWordService:
    def __init__(self, access_key: str, on_wake: Callable[[], None]) -> None:
        self._porcupine = pvporcupine.create(
            access_key=access_key,
            keywords=["jarvis"],
        )
        self._on_wake   = on_wake
        self._running   = False
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        logger.info("[WakeWord] Listening for 'JARVIS'...")

    def stop(self) -> None:
        self._running = False

    def _listen_loop(self) -> None:
        frame_length  = self._porcupine.frame_length
        sample_rate   = self._porcupine.sample_rate

        with sd.InputStream(
            samplerate=sample_rate,
            channels=1,
            dtype="int16",
            blocksize=frame_length,
        ) as stream:
            while self._running:
                audio_frame, _ = stream.read(frame_length)
                keyword_index  = self._porcupine.process(audio_frame.flatten())
                if keyword_index >= 0:
                    logger.info("[WakeWord] Wake word detected — activating call mode")
                    self._on_wake()
