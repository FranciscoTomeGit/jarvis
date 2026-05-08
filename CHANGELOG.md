# Changelog

All notable changes to J.A.R.V.I.S. are documented here.

---

## V0.5 — JARVIS Voice
*ElevenLabs neural TTS, speech speed control, orb animation sync fix*

### Added
- **ElevenLabs TTS** — JARVIS now speaks with a neural voice (Paul Bettany-style British male). Routed through the Python backend to keep the API key secure. Falls back to browser TTS if unconfigured.
- **Speech speed control** — 1× / 1.5× / 2× buttons in the input bar. Updates live mid-playback via `HTMLAudioElement.playbackRate`.
- `TTSService` — async httpx wrapper around the ElevenLabs v1 API (`eleven_multilingual_v2`).
- `POST /api/speech/synthesize` endpoint returning raw `audio/mpeg` bytes.

### Fixed
- **Orb animation sync** — `_setSpeaking(true)` was firing synchronously before `setMode('idle')` could run, causing the orb to never enter the speaking state. Moved to fire only when audio actually starts playing.
- Background CPU drain when minimized to tray — orb render loop now pauses via `visibilitychange` event.

---

## V0.4 — Holographic Orb
*3D network sphere visualizer*

### Added
- **JarvisOrb canvas visualizer** — 52 great circle arcs distributed across a true 3D sphere using pole-based parameterization with orthonormal basis vectors. Depth-based arc opacity for see-through holographic effect.
- 80 surface nodes with individual pulse phases and halos. Energy pulses travel along arc paths during listening/speaking.
- Dual-axis rotation (X + Y) for organic motion. Color interpolates from cyan (idle) to cyan-green (speaking).
- Smooth intensity easing with four states: idle (0.08), thinking (0.30), listening (0.55), speaking (1.00).
- Orb section (280px) above the messages area. `ResizeObserver` + `devicePixelRatio` scaling for crisp rendering.

---

## V0.3 — Voice I/O + Code Quality
*Python mic recording, device selector, full refactor*

### Added
- **Python microphone recording** — `sounddevice` + `SpeechRecognition` pipeline capturing from the OS mic directly, bypassing Electron's broken `webkitSpeechRecognition` (no Chrome API key in Electron).
- **Silence detection** — RMS-based VAD stops recording after 1.5s of silence; per-chunk logging for debugging.
- **Input device selector** — sidebar dropdown populated from `/api/speech/devices`; selection persisted in `localStorage`.
- `SpeechService` with `list_devices()`, `listen()`, `_record_until_silence()`, `_encode_as_wav()`, `_compute_rms()`.
- Electron microphone permission granted via `session.setPermissionRequestHandler`.
- Disabled uvicorn hot-reload under Electron (`ELECTRON=1` env var) to prevent orphaned child processes.

### Changed — full code quality refactor
- No abbreviations in variable names (`conn`, `buf`, `wf`, `d`, `r`, `SR`, `fn`, `utter`, `on`, `conv`, `msg`, `val`, `opt`... all renamed).
- Single-responsibility extraction: `_require_conversation`, `_build_user_content`, `_createJarvisMessageFrame`, `_buildJarvisMessageFrame`, `_resizeInputBox`, `_streamReply`, `_cleanTextForSpeech`, `_buildUtterance`, `_startListeningViaPython`, `_startListeningViaBrowserApi`.
- `gemini_client.py` renamed to `claude_client.py`.
- `rename_conversation` / `delete_conversation` return `bool` — eliminates the exists-check + action double query.
- `_deleteConversation` hoists `listConversations` before branch (one fetch instead of two).
- `_maybeAutoTitle` mutates local list instead of fetching twice.
- O(n²) string concat in streaming generator replaced with `list.append` + `"".join`.
- `asyncio.get_event_loop()` → `asyncio.get_running_loop()`.

---

## V0.2 — Electron Desktop Shell
*Native desktop app, system tray, global hotkey*

### Added
- **Electron wrapper** — `JarvisApp` class orchestrates the full desktop lifecycle: spawns Python on startup, waits for readiness, creates a frameless `BrowserWindow`, registers global shortcuts, and tears everything down cleanly on quit.
- **System tray** — `TrayManager` with icon, tooltip, right-click menu (Open / Quit), and double-click to show.
- **Global hotkey** `Ctrl+Shift+J` — shows/hides JARVIS from any application.
- **Single-instance lock** — second launch focuses the existing window instead of opening a new one.
- **Frameless window** — custom `─` / `✕` controls in the header (visible only in Electron). Header is draggable via `-webkit-app-region: drag`.
- **Secure IPC** — `preload.js` exposes only `minimize` and `close` to the renderer via `contextBridge`.
- `PythonServer` polls `localhost:8000` until ready, with a 20-second timeout and startup error dialog.
- `ELECTRON=1` env flag disables uvicorn hot-reload so the server process is fully owned and cleanly killed.

---

## V0.1 — Foundation
*Core app: FastAPI backend, modular JS frontend, persistent conversations*

### Added
- **FastAPI backend** serving both API routes and static frontend from a single process.
- **SSE streaming** — responses stream word-by-word via `StreamingResponse` and a `for await` async generator on the frontend.
- **SQLite persistence** via `sqlite3` stdlib — conversations and messages survive restarts.
- **ConversationStore** — full CRUD (create, list, get messages, rename, delete, exists check).
- **ClaudeClient** — async Anthropic SDK wrapper with streaming.
- **Conversation sidebar** — switch between past chats, delete, auto-titled from first message.
- **Code context panel** — paste code in the sidebar; injected into the user message as a code block.
- **Voice input** (browser Web Speech API) + **text-to-speech** (browser `speechSynthesis`).
- Modular JS architecture: `JarvisApp`, `JarvisAPI`, `UIManager`, `SpeechManager` — one responsibility per class.
- JARVIS sci-fi aesthetic: dark UI, cyan palette, animated arc reactor, equalizer bars, scanline overlay.
- `python run.py` → `http://localhost:8000`.
