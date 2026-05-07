class SpeechManager {
    constructor() {
        this._synth = window.speechSynthesis;
        this._recognition = null;
        this._listening = false;
        this._speaking = false;
        this._onListeningChange = null;
        this._onSpeakingChange = null;

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
            this._recognition = new SR();
            this._recognition.continuous = false;
            this._recognition.interimResults = false;
            this._recognition.lang = 'en-US';
        }
    }

    // Available if running in Electron (uses Python mic) or browser Web Speech API
    get isAvailable() { return window.electron != null || this._recognition !== null; }

    setDevice(index) {
        this._selectedDevice = index != null ? Number(index) : null;
    }
    get isListening() { return this._listening; }
    get isSpeaking() { return this._speaking; }

    onListeningChange(fn) { this._onListeningChange = fn; }
    onSpeakingChange(fn) { this._onSpeakingChange = fn; }

    startListening(onResult) {
        if (this._listening) return;

        // In Electron: mic is captured by Python directly, no browser API key needed
        if (window.electron) {
            this._setListening(true);
            const device = this._selectedDevice ?? null;
            console.log('[Mic] Recording started — device:', device ?? 'default');
            fetch('/api/speech/listen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device }),
            })
                .then(res => {
                    if (!res.ok) return res.json().then(e => { throw new Error(e.detail); });
                    return res.json();
                })
                .then(data => {
                    this._setListening(false);
                    console.log('[Mic] Transcribed:', data.text);
                    if (data.text) onResult(data.text);
                })
                .catch(err => {
                    this._setListening(false);
                    console.error('[Mic] Error:', err.message);
                });
            return;
        }

        // Browser fallback: Web Speech API
        if (!this._recognition) return;

        this._recognition.onresult = (e) => {
            const text = e.results[0][0].transcript;
            this._setListening(false);
            onResult(text);
        };
        this._recognition.onerror = () => this._setListening(false);
        this._recognition.onend = () => this._setListening(false);

        this._recognition.start();
        this._setListening(true);
    }

    stopListening() {
        if (window.electron) {
            // Backend listen() is blocking — clicking again just resets the UI state
            this._setListening(false);
            return;
        }
        if (!this._recognition || !this._listening) return;
        try { this._recognition.stop(); } catch (_) {}
        this._setListening(false);
    }

    speak(text) {
        if (!this._synth) return;
        this._synth.cancel();

        const clean = text
            .replace(/```[\s\S]*?```/g, 'code block omitted')
            .replace(/`([^`]+)`/g, '$1');

        const utter = new SpeechSynthesisUtterance(clean);
        utter.rate = 0.95;
        utter.pitch = 0.85;
        utter.volume = 1;

        const voices = this._synth.getVoices();
        const preferred = voices.find(v =>
            v.name.includes('Daniel') ||
            v.name.includes('Alex') ||
            v.name.includes('Google UK') ||
            v.lang === 'en-GB'
        );
        if (preferred) utter.voice = preferred;

        utter.onstart = () => this._setSpeaking(true);
        utter.onend = () => this._setSpeaking(false);
        utter.onerror = () => this._setSpeaking(false);

        this._synth.speak(utter);
    }

    stopSpeaking() {
        if (this._synth) this._synth.cancel();
    }

    _setListening(value) {
        this._listening = value;
        if (this._onListeningChange) this._onListeningChange(value);
    }

    _setSpeaking(value) {
        this._speaking = value;
        if (this._onSpeakingChange) this._onSpeakingChange(value);
    }
}
