# J.A.R.V.I.S.

> Just A Rather Very Intelligent System

A personal AI desktop assistant with a sci-fi interface inspired by Iron Man's JARVIS. Built with a FastAPI Python backend, a vanilla JS frontend, and an Electron shell — runs as a native desktop app with system tray integration, a holographic orb visualizer, neural TTS voice, voice input, streaming responses, and persistent conversation history.

![Version](https://img.shields.io/badge/version-V0.5-00d4ff?style=flat-square)
![Stack](https://img.shields.io/badge/stack-Electron%20%2B%20FastAPI%20%2B%20Vanilla%20JS-00d4ff?style=flat-square)
![Python](https://img.shields.io/badge/python-3.11%2B-blue?style=flat-square)

---

## Features

- **Holographic orb** — 3D network sphere that pulses and animates with JARVIS's state (idle, listening, thinking, speaking)
- **Neural TTS voice** — ElevenLabs integration for a Paul Bettany-style British voice; 1× / 1.5× / 2× speed control
- **Desktop app** — native frameless window via Electron, lives in the system tray
- **Global hotkey** — `Ctrl+Shift+J` opens/hides JARVIS from anywhere on the desktop
- **Streaming responses** — text appears word-by-word as Claude generates it
- **Python voice input** — OS-level mic recording via sounddevice with silence detection
- **Input device selector** — choose which microphone JARVIS listens to
- **Code context panel** — paste code in the sidebar for JARVIS to reference when answering
- **Persistent chat history** — conversations saved to SQLite, survive restarts
- **Conversation sidebar** — switch between past chats, auto-titled from first message
- **JARVIS aesthetic** — dark sci-fi UI, frameless window, drag-to-move header, cyan accents, scanline overlay

---

## Architecture

```
Electron shell  (frameless window, system tray, Ctrl+Shift+J)
      ↕  spawns on startup
Python / FastAPI  (AI brain, TTS, mic recording, conversation storage)
      ↕  calls
Anthropic Claude API  (claude-sonnet-4-6)   +   ElevenLabs TTS API
      ↕  future
OS tools  (file system, apps, desktop control via tool use)
```

The Python backend is the long-term "brain" — Claude tool use will be added here when JARVIS gains desktop capabilities.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 33 |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Voice (TTS) | ElevenLabs API (`eleven_multilingual_v2`) |
| Voice (input) | sounddevice + SpeechRecognition |
| Database | SQLite via Python `sqlite3` stdlib |
| Frontend | Vanilla HTML, CSS, JavaScript (Canvas API for orb) |
| Streaming | Server-Sent Events (SSE) |

---

## Project Structure

```
Jarvis/
├── electron/
│   ├── main.js              # JarvisApp — app lifecycle, window, tray, shortcuts
│   ├── server.js            # PythonServer — spawns and monitors the backend
│   ├── tray.js              # TrayManager — system tray icon and menu
│   └── preload.js           # IPC bridge — exposes window controls to the renderer
├── backend/
│   ├── main.py              # FastAPI app, serves frontend + API
│   ├── config.py            # Settings loaded from .env
│   ├── database.py          # SQLite init
│   ├── api/
│   │   ├── routes.py        # All API endpoints
│   │   └── models.py        # Pydantic request/response models
│   └── services/
│       ├── claude_client.py      # Anthropic SDK async streaming wrapper
│       ├── tts_service.py        # ElevenLabs TTS (httpx, returns audio/mpeg)
│       ├── speech_service.py     # Python mic recording + Google transcription
│       └── conversation_store.py # SQLite CRUD for conversations and messages
├── frontend/
│   ├── index.html           # Main UI shell
│   ├── css/jarvis.css       # All styles
│   └── js/
│       ├── orb.js           # JarvisOrb — holographic 3D orb (Canvas API)
│       ├── app.js           # JarvisApp — main orchestrator
│       ├── api.js           # JarvisAPI — backend HTTP + SSE streaming
│       ├── ui.js            # UIManager — DOM, animations, orb state
│       └── speech.js        # SpeechManager — mic input + ElevenLabs/browser TTS
├── assets/
│   └── icon.png             # App icon (replace with your own)
├── data/                    # SQLite database (gitignored)
├── .env.example             # Environment variable template
├── CHANGELOG.md             # Version history
├── package.json             # Node/Electron config
├── requirements.txt         # Python dependencies
└── run.py                   # Entry point (Electron spawns this; also works standalone)
```

---

## Setup

### Prerequisites

- [Python 3.11+](https://python.org)
- [Node.js 20+](https://nodejs.org) — required for Electron

### 1. Clone the repo

```bash
git clone https://github.com/FranciscoTomeGit/jarvis.git
cd jarvis
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Electron

```bash
npm install
```

### 4. Configure environment

Copy `.env.example` to `.env`:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-your_key_here
MODEL=claude-sonnet-4-6
MAX_TOKENS=2048
DB_PATH=data/conversations.db

# Optional — ElevenLabs neural TTS (free tier: 10k chars/month)
# Browse voices at elevenlabs.io/voice-library, copy the voice ID from the URL
# Default voice: Daniel — British authoritative male
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=onwK4e9ZLuTAKqWW03F9
```

- Anthropic key: [console.anthropic.com](https://console.anthropic.com)
- ElevenLabs key: [elevenlabs.io](https://elevenlabs.io) — free tier is enough for daily personal use

### 5. Add an app icon (optional)

Place a `icon.png` (256×256) in the `assets/` folder.

---

## Running

**Desktop app (Electron):**
```bash
npm start
```
Electron spawns the Python backend, opens the JARVIS window. Close to minimize to tray. Right-click tray icon to quit.

**Browser mode (no Electron):**
```bash
python run.py
```
Open [http://localhost:8000](http://localhost:8000). Voice input uses the browser Web Speech API in this mode.

---

## Usage

| Action | How |
|--------|-----|
| Open / hide JARVIS | `Ctrl+Shift+J` or double-click tray icon |
| Send a message | Type and press `Enter` |
| New line | `Shift+Enter` |
| Voice input | Click 🎤, speak, auto-sends on silence |
| Code context | Paste code in the left sidebar |
| New chat | `+ NEW CHAT` in the sidebar |
| Switch conversations | Click any entry in the sidebar |
| Delete conversation | Hover entry → click `✕` |
| Change speech speed | `1×` / `1.5×` / `2×` buttons in the input bar |
| Close to tray | Click `✕` in the header |
| Quit | Right-click tray icon → Quit |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/conversations` | Create a new conversation |
| `GET` | `/api/conversations` | List all conversations |
| `PATCH` | `/api/conversations/{id}` | Rename a conversation |
| `DELETE` | `/api/conversations/{id}` | Delete a conversation |
| `GET` | `/api/conversations/{id}/messages` | Get full message history |
| `POST` | `/api/conversations/{id}/chat` | Send a message (SSE streaming) |
| `GET` | `/api/speech/devices` | List available microphone devices |
| `POST` | `/api/speech/listen` | Record and transcribe from mic |
| `POST` | `/api/speech/synthesize` | Convert text to speech (ElevenLabs) |

---

## Cost

| Service | Usage | Est. cost |
|---------|-------|-----------|
| Anthropic `claude-sonnet-4-6` | 10–20 msg/day | ~$0.10–0.20/day |
| ElevenLabs TTS | Free tier | 10,000 chars/month free |

$20 in Anthropic credits lasts approximately 3–6 months at typical personal use. Switch to `claude-haiku-4-5` in `.env` for ~10× cheaper inference.

---

## Roadmap

- [ ] Desktop tool use (open files, search, run commands via Claude tool use API)
- [ ] Voice wake word detection ("Hey JARVIS")
- [ ] System tray notifications
- [ ] Packaging as a standalone `.exe` (PyInstaller + electron-builder)
- [ ] Conversation search
- [ ] Settings panel (voice, model, theme)

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

**Current: V0.5** — ElevenLabs neural TTS, speech speed control, holographic orb, Python voice I/O, Electron desktop shell.
