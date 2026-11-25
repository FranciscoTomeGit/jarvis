"""Local speech-to-text with faster-whisper — runs on the GPU, audio never leaves the PC."""
import glob
import logging
import os
import sys
import threading

import numpy as np

logger = logging.getLogger(__name__)


def _expose_cuda_libraries() -> None:
    """Make pip-installed NVIDIA DLLs (nvidia-cublas-cu12, nvidia-cudnn-cu12) loadable on Windows."""
    if sys.platform != "win32":
        return
    try:
        import nvidia
    except ImportError:
        return
    library_dirs = [d for root in nvidia.__path__ for d in glob.glob(os.path.join(root, "*", "bin"))]
    for directory in library_dirs:
        os.add_dll_directory(directory)
    os.environ["PATH"] = os.pathsep.join(library_dirs + [os.environ.get("PATH", "")])


class WhisperTranscriber:
    def __init__(self, model_name: str, device: str, language: str) -> None:
        self._model_name = model_name
        self._device = device
        self._language = language or None  # None = auto-detect
        self._model = None
        self._load_lock = threading.Lock()
        self._transcribe_lock = threading.Lock()

    def load(self) -> None:
        """Load and warm up the model. Safe to call repeatedly / from a background thread."""
        with self._load_lock:
            if self._model is not None:
                return
            _expose_cuda_libraries()
            from faster_whisper import WhisperModel

            candidates = [("cuda", "float16"), ("cpu", "int8")]
            if self._device in ("cuda", "cpu"):
                candidates = [c for c in candidates if c[0] == self._device]

            last_error: Exception | None = None
            for device, compute_type in candidates:
                try:
                    model = self._create_model(WhisperModel, device, compute_type)
                    # First inference compiles GPU kernels — do it now, not on the user's first sentence.
                    list(model.transcribe(np.zeros(16000, dtype=np.float32), language=self._language)[0])
                    self._model = model
                    logger.info(f"[Whisper] {self._model_name} ready on {device} ({compute_type})")
                    return
                except Exception as error:
                    last_error = error
                    logger.warning(f"[Whisper] Could not load on {device}: {error}")
            raise RuntimeError(f"Whisper failed to load: {last_error}")

    def _create_model(self, model_class, device: str, compute_type: str):
        # Use the cached copy without contacting Hugging Face; download only the first time.
        try:
            return model_class(self._model_name, device=device, compute_type=compute_type, local_files_only=True)
        except Exception:
            logger.info(f"[Whisper] Downloading {self._model_name} (first run only)...")
            return model_class(self._model_name, device=device, compute_type=compute_type)

    def transcribe(self, audio_int16: np.ndarray) -> str:
        self.load()
        audio = audio_int16.flatten().astype(np.float32) / 32768.0
        with self._transcribe_lock:
            segments, _ = self._model.transcribe(
                audio,
                language=self._language,
                beam_size=5,
                vad_filter=True,                  # skip silence; avoids hallucinated text on noise
                condition_on_previous_text=False,
            )
            return " ".join(segment.text.strip() for segment in segments).strip()
