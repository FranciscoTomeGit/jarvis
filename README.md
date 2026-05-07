# J.A.R.V.I.S.

> Just A Rather Very Intelligent System

A personal AI assistant with a sci-fi interface inspired by Iron Man's JARVIS. Built with a FastAPI Python backend and a vanilla JS frontend, featuring voice input, text-to-speech output, streaming responses, and persistent conversation history.

![JARVIS Interface](https://img.shields.io/badge/stack-FastAPI%20%2B%20Vanilla%20JS-00d4ff?style=flat-square)
![Python](https://img.shields.io/badge/python-3.11%2B-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

- **Streaming responses** — text appears word-by-word as the AI generates it
- **Voice input** — click the mic button and speak your question
- **Text-to-speech** — every response is spoken aloud (prefers deep English voices)
- **Code context panel** — paste code in the sidebar for JARVIS to reference when answering
- **Persistent chat history** — conversations are saved to SQLite and survive restarts
- **Conversation sidebar** — switch between past conversations, delete them, auto-titled from first message
- **JARVIS aesthetic** — dark sci-fi UI with cyan accents, animated arc reactor, equalizer signal bars, scanline effect

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Database | SQLite via Python `sqlite3` stdlib |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Speech | Web Speech API (browser built-in) |
| Streaming | Server-Sent Events (SSE) |

No React, no Docker, no ORM, no build step. One command to run everything.

---

## Project Structure

```
Jarvis/
├── backend/
│   ├── main.py                  # FastAPI app, serves frontend + API
│   ├── config.py                # Settings loaded from .env
│   ├── database.py              # SQLite init
│   ├── api/
│   │   ├── routes.py            # All API endpoints
│   │   └── models.py            # Pydantic request/response models
│   └── services/
│       ├── gemini_client.py     # Anthropic SDK streaming wrapper
│       └── conversation_store.py # SQLite CRUD for conversations
├── frontend/
│   ├── index.html               # Main UI shell
│   ├── css/jarvis.css           # All styles
│   └── js/
│       ├── app.js               # JarvisApp — main orchestrator
│       ├── api.js               # JarvisAPI — backend HTTP calls
│       ├── ui.js                # UIManager — DOM & animations
│       └── speech.js            # SpeechManager — mic & TTS
├── data/                        # SQLite database (gitignored)
├── .env.example                 # Environment variable template
├── requirements.txt
└── run.py                       # Entry point
```

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/FranciscoTomeGit/jarvis.git
cd jarvis
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

Copy `.env.example` to `.env` and add your Anthropic API key:

```bash
cp .env.example .env
```

```env
ANTHROPIC_API_KEY=sk-ant-your_key_here
MODEL=claude-sonnet-4-6
MAX_TOKENS=2048
DB_PATH=data/conversations.db
```

Get your API key at [console.anthropic.com](https://console.anthropic.com).

### 4. Run

```bash
python run.py
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

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

- **Send a message** — type and press `Enter`, or `Shift+Enter` for a new line
- **Voice input** — click the mic button, speak, message auto-sends
- **Code context** — paste any code in the left sidebar; JARVIS will use it when answering questions
- **New chat** — click `+ NEW CHAT` in the sidebar
- **Switch conversations** — click any conversation in the sidebar to load it
- **Delete conversation** — hover a conversation and click `✕`

---

## Cost

Using `claude-sonnet-4-6` at typical personal assistant usage (10–20 messages/day):

- ~$0.10–0.20 per day
- $20 in credits lasts approximately 3–6 months

For lighter usage, switch to `claude-haiku-4-5` in your `.env` — about 10× cheaper.
