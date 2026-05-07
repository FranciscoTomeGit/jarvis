# J.A.R.V.I.S.

> Just A Rather Very Intelligent System

A personal AI desktop assistant with a sci-fi interface inspired by Iron Man's JARVIS. Built with a FastAPI Python backend, a vanilla JS frontend, and an Electron shell — runs as a native desktop app with system tray integration, global hotkey, voice input, text-to-speech, streaming responses, and persistent conversation history.

![Stack](https://img.shields.io/badge/stack-Electron%20%2B%20FastAPI%20%2B%20Vanilla%20JS-00d4ff?style=flat-square)
![Python](https://img.shields.io/badge/python-3.11%2B-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

- **Desktop app** — runs as a native window via Electron, lives in the system tray
- **Global hotkey** — `Ctrl+Shift+J` opens/hides JARVIS from anywhere on the desktop
- **Streaming responses** — text appears word-by-word as the AI generates it
- **Voice input** — click the mic button and speak your question
- **Text-to-speech** — every response is spoken aloud (prefers deep English voices)
- **Code context panel** — paste code in the sidebar for JARVIS to reference
- **Persistent chat history** — conversations saved to SQLite, survive restarts
- **Conversation sidebar** — switch between past chats, auto-titled from first message
- **JARVIS aesthetic** — dark sci-fi UI, frameless window, drag-to-move header, cyan accents

---

## Architecture

```
Electron shell  (frameless window, system tray, global hotkey)
      ↕  spawns on startup
Python / FastAPI  (AI brain, conversation storage, streaming)
      ↕  calls
Anthropic Claude API  (claude-sonnet-4-6)
      ↕  future
OS tools  (file system, apps, desktop control via tool use)
```

The Python backend is the long-term "brain" — tool use will be added here when JARVIS gains desktop capabilities.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 33 |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Database | SQLite via Python `sqlite3` stdlib |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Speech | Web Speech API (browser built-in) |
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
│       ├── gemini_client.py     # Anthropic SDK streaming wrapper (ClaudeClient)
│       └── conversation_store.py # SQLite CRUD for conversations
├── frontend/
│   ├── index.html           # Main UI shell
│   ├── css/jarvis.css       # All styles (includes Electron drag region)
│   └── js/
│       ├── app.js           # JarvisApp — main orchestrator
│       ├── api.js           # JarvisAPI — backend HTTP calls + SSE streaming
│       ├── ui.js            # UIManager — DOM & animations
│       └── speech.js        # SpeechManager — mic & TTS
├── assets/
│   └── icon.png             # App icon (replace with your own)
├── data/                    # SQLite database (gitignored)
├── .env.example             # Environment variable template
├── package.json             # Node/Electron config
├── requirements.txt         # Python dependencies
└── run.py                   # Python entry point (used by Electron and browser mode)
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

Copy `.env.example` to `.env` and add your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-your_key_here
MODEL=claude-sonnet-4-6
MAX_TOKENS=2048
DB_PATH=data/conversations.db
```

Get your API key at [console.anthropic.com](https://console.anthropic.com).

### 5. Add an app icon (optional)

Place a `icon.png` (256×256 recommended) in the `assets/` folder. Without it the app still runs — just with no tray icon image.

---

## Running

**As a desktop app (Electron):**
```bash
npm start
```
Electron starts, spawns the Python backend automatically, and opens the JARVIS window. Close the window to minimize to tray. Right-click the tray icon to quit.

**As a browser app (no Electron needed):**
```bash
python run.py
```
Then open [http://localhost:8000](http://localhost:8000).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+J` | Show / hide JARVIS from anywhere |
| `Enter` | Send message |
| `Shift+Enter` | New line in message |

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

---

## Usage

- **Open JARVIS** — `Ctrl+Shift+J` or double-click the tray icon
- **Send a message** — type and press `Enter`
- **Voice input** — click the mic button, speak, message auto-sends
- **Code context** — paste any code in the left sidebar; JARVIS will reference it
- **New chat** — click `+ NEW CHAT` in the sidebar
- **Switch conversations** — click any conversation in the sidebar
- **Close to tray** — click `✕` in the header (app keeps running in background)
- **Quit** — right-click the tray icon → Quit

---

## Cost

Using `claude-sonnet-4-6` at typical personal assistant usage (10–20 messages/day):

- ~$0.10–0.20 per day
- $20 in credits lasts approximately 3–6 months

For lighter usage, switch to `claude-haiku-4-5` in your `.env` — about 10× cheaper.

---

## Roadmap

- [ ] Desktop tool use (open files, search, run commands)
- [ ] System tray notifications
- [ ] Voice wake word ("Hey JARVIS")
- [ ] Packaging as a standalone `.exe` installer (PyInstaller + electron-builder)
