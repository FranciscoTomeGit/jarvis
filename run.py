import os
import uvicorn

if __name__ == "__main__":
    # Reload is useful during browser-based development.
    # Disabled under Electron — it manages the process lifecycle directly,
    # and reload's child process can outlive the parent, causing stale servers.
    reload = os.getenv("ELECTRON") != "1"
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=reload)
