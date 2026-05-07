const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 8000;
const READY_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 400;

class PythonServer {
    constructor() {
        this._process = null;
    }

    start() {
        const root = path.join(__dirname, '..');

        this._process = spawn('python', ['run.py'], {
            cwd: root,
            env: { ...process.env },
            windowsHide: true,  // don't flash a console window on Windows
        });

        this._process.stdout.on('data', d => console.log('[Python]', d.toString().trim()));
        this._process.stderr.on('data', d => console.error('[Python]', d.toString().trim()));
        this._process.on('exit', code => console.log(`[Python] exited with code ${code}`));
    }

    // Polls localhost until the server responds, then resolves.
    waitUntilReady() {
        return new Promise((resolve, reject) => {
            const deadline = Date.now() + READY_TIMEOUT_MS;

            const poll = () => {
                if (Date.now() > deadline) {
                    return reject(new Error('Python server did not start within the timeout.'));
                }
                this._ping().then(ready => {
                    if (ready) resolve();
                    else setTimeout(poll, POLL_INTERVAL_MS);
                });
            };

            poll();
        });
    }

    stop() {
        if (this._process) {
            this._process.kill();
            this._process = null;
        }
    }

    _ping() {
        return new Promise(resolve => {
            const req = http.get(`http://127.0.0.1:${PORT}/`, res => {
                resolve(res.statusCode < 500);
            });
            req.on('error', () => resolve(false));
            req.end();
        });
    }
}

module.exports = PythonServer;
