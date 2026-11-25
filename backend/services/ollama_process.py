"""Starts the Ollama server together with Jarvis and stops it when Jarvis exits.

If Ollama is already running (e.g. the user opened the Ollama app), it is left
alone. Otherwise `ollama serve` is launched as a child process. On Windows the
child is placed in a Job Object with KILL_ON_JOB_CLOSE, so it dies with Jarvis
even when Jarvis is force-killed (as Electron does), never lingering in the
background.
"""
import ctypes
import logging
import os
import shutil
import subprocess
import sys
import time
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_process: subprocess.Popen | None = None
_job_handle = None


def _is_running(base_url: str) -> bool:
    try:
        return httpx.get(f"{base_url}/api/version", timeout=1.0).status_code == 200
    except httpx.HTTPError:
        return False


def _find_executable() -> str | None:
    found = shutil.which("ollama")
    if found:
        return found
    default = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Ollama", "ollama.exe")
    return default if os.path.isfile(default) else None


def _bind_to_current_process(process: subprocess.Popen) -> None:
    """Windows only: kill `process` automatically when this Python process exits."""
    global _job_handle
    if sys.platform != "win32":
        return

    class IO_COUNTERS(ctypes.Structure):
        _fields_ = [(name, ctypes.c_ulonglong) for name in (
            "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
            "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]

    class BASIC_LIMIT(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_int64),
            ("PerJobUserTimeLimit", ctypes.c_int64),
            ("LimitFlags", ctypes.c_uint32),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", ctypes.c_uint32),
            ("Affinity", ctypes.c_size_t),
            ("PriorityClass", ctypes.c_uint32),
            ("SchedulingClass", ctypes.c_uint32),
        ]

    class EXTENDED_LIMIT(ctypes.Structure):
        _fields_ = [
            ("BasicLimitInformation", BASIC_LIMIT),
            ("IoInfo", IO_COUNTERS),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000
    JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateJobObjectW.restype = ctypes.c_void_p
    kernel32.SetInformationJobObject.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]
    kernel32.AssignProcessToJobObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]

    job = kernel32.CreateJobObjectW(None, None)
    info = EXTENDED_LIMIT()
    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    ok = kernel32.SetInformationJobObject(
        job, JOB_OBJECT_EXTENDED_LIMIT_INFORMATION, ctypes.byref(info), ctypes.sizeof(info))
    ok = ok and kernel32.AssignProcessToJobObject(job, ctypes.c_void_p(int(process._handle)))
    if not ok:
        logger.warning(f"[Ollama] Could not bind server lifetime to Jarvis (error {ctypes.get_last_error()})")
        return
    _job_handle = job  # must stay open for the lifetime of Jarvis


def start(base_url: str) -> None:
    global _process
    host = urlparse(base_url).hostname
    if host not in ("localhost", "127.0.0.1"):
        return  # remote Ollama — not ours to manage
    if _is_running(base_url):
        logger.info("[Ollama] Already running — using existing server")
        return

    executable = _find_executable()
    if not executable:
        logger.error("[Ollama] Not installed — get it from ollama.com")
        return

    creation_flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    _process = subprocess.Popen(
        [executable, "serve"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creation_flags,
    )
    _bind_to_current_process(_process)

    for _ in range(40):
        if _is_running(base_url):
            logger.info("[Ollama] Server started")
            return
        time.sleep(0.25)
    logger.error("[Ollama] Server did not start within 10s")


def stop() -> None:
    global _process
    if _process and _process.poll() is None:
        _process.terminate()
        try:
            _process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _process.kill()
        logger.info("[Ollama] Server stopped")
    _process = None
