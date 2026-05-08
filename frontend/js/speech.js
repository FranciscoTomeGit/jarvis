class SpeechManager {
    constructor() {
        this._synth               = window.speechSynthesis;
        this._recognition         = null;
        this._selectedDevice      = null;
        this._playbackRate        = 1;
        this._listening           = false;
        this._speaking            = false;
        this._onListeningChange   = null;
        this._onSpeakingChange    = null;
        this._currentAudio        = null;
        this._synthesisController = null;

        const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognitionConstructor) {
            this._recognition = new SpeechRecognitionConstructor();
            this._recognition.continuous     = false;
            this._recognition.interimResults  = false;
            this._recognition.lang            = 'en-US';
        }
    }

    get isAvailable() { return window.electron != null || this._recognition !== null; }
    get isListening()  { return this._listening; }
    get isSpeaking()   { return this._speaking; }

    onListeningChange(callback) { this._onListeningChange = callback; }
    onSpeakingChange(callback)  { this._onSpeakingChange  = callback; }

    setDevice(index) {
        this._selectedDevice = index != null ? Number(index) : null;
    }

    setPlaybackRate(rate) {
        this._playbackRate = rate;
        if (this._currentAudio) this._currentAudio.playbackRate = rate;
    }

    // ── Listening ─────────────────────────────────────────────────────────────

    startListening(onResult) {
        if (this._listening) return;
        if (window.electron) {
            this._startListeningViaPython(onResult);
        } else {
            this._startListeningViaBrowserApi(onResult);
        }
    }

    stopListening() {
        if (window.electron) {
            this._setListening(false);
            return;
        }
        if (!this._recognition || !this._listening) return;
        try { this._recognition.stop(); } catch (_) {}
        this._setListening(false);
    }

    // ── Speaking ──────────────────────────────────────────────────────────────

    speak(text) {
        if (this._synthesisController) this._synthesisController.abort();
        this._stopCurrentAudio();
        if (this._synth) this._synth.cancel();

        const cleanText = this._cleanTextForSpeech(text);
        this._synthesisController = new AbortController();
        const { signal } = this._synthesisController;

        // Note: _setSpeaking(true) is NOT called here — it fires when audio
        // actually starts, avoiding a race with setMode('idle') in _handleSend.
        this._playViaBackend(cleanText, signal).catch(() => {
            if (!signal.aborted) this._playViaBrowser(cleanText);
        });
    }

    stopSpeaking() {
        if (this._synthesisController) this._synthesisController.abort();
        this._stopCurrentAudio();
        if (this._synth) this._synth.cancel();
        this._setSpeaking(false);
    }

    // ── Private: listening ────────────────────────────────────────────────────

    async _startListeningViaPython(onResult) {
        this._setListening(true);
        console.log('[Mic] Recording started — device:', this._selectedDevice ?? 'default');
        try {
            const response = await fetch('/api/speech/listen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device: this._selectedDevice ?? null }),
            });
            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.detail);
            }
            const data = await response.json();
            console.log('[Mic] Transcribed:', data.text);
            if (data.text) onResult(data.text);
        } catch (error) {
            console.error('[Mic] Error:', error.message);
        } finally {
            this._setListening(false);
        }
    }

    _startListeningViaBrowserApi(onResult) {
        if (!this._recognition) return;
        this._recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            this._setListening(false);
            onResult(text);
        };
        this._recognition.onerror = () => this._setListening(false);
        this._recognition.onend   = () => this._setListening(false);
        this._recognition.start();
        this._setListening(true);
    }

    // ── Private: speaking ─────────────────────────────────────────────────────

    async _playViaBackend(text, signal) {
        const response = await fetch('/api/speech/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            signal,
        });
        if (!response.ok) throw new Error(`TTS ${response.status}`);

        const audioBlob = await response.blob();
        const audioUrl  = URL.createObjectURL(audioBlob);
        this._currentAudio = new Audio(audioUrl);
        this._currentAudio.playbackRate = this._playbackRate;

        // Signal speaking only when audio is ready — not during the fetch delay
        this._setSpeaking(true);

        return new Promise((resolve) => {
            const cleanup = () => {
                URL.revokeObjectURL(audioUrl);
                this._currentAudio = null;
                this._setSpeaking(false);
                resolve();
            };
            this._currentAudio.onended = cleanup;
            this._currentAudio.onerror = cleanup;
            this._currentAudio.play().catch(cleanup);
        });
    }

    _playViaBrowser(text) {
        if (!this._synth) return;
        const utterance    = this._buildUtterance(text);
        utterance.onstart  = () => this._setSpeaking(true);
        utterance.onend    = () => this._setSpeaking(false);
        utterance.onerror  = () => this._setSpeaking(false);
        this._synth.speak(utterance);
    }

    _stopCurrentAudio() {
        if (this._currentAudio) {
            this._currentAudio.onended = null;
            this._currentAudio.onerror = null;
            this._currentAudio.pause();
            this._currentAudio = null;
        }
    }

    // ── Private: text prep & utterance ────────────────────────────────────────

    _cleanTextForSpeech(text) {
        return text
            .replace(/```[\s\S]*?```/g, 'code block omitted')
            .replace(/`([^`]+)`/g, '$1');
    }

    _buildUtterance(text) {
        const utterance  = new SpeechSynthesisUtterance(text);
        utterance.rate   = 0.95 * this._playbackRate;
        utterance.pitch  = 0.85;
        utterance.volume = 1;

        const preferredVoice = this._synth.getVoices().find(voice =>
            voice.name.includes('Daniel')    ||
            voice.name.includes('Alex')      ||
            voice.name.includes('Google UK') ||
            voice.lang === 'en-GB'
        );
        if (preferredVoice) utterance.voice = preferredVoice;
        return utterance;
    }

    // ── Private: state ────────────────────────────────────────────────────────

    _setListening(isActive) {
        this._listening = isActive;
        if (this._onListeningChange) this._onListeningChange(isActive);
    }

    _setSpeaking(isActive) {
        this._speaking = isActive;
        if (this._onSpeakingChange) this._onSpeakingChange(isActive);
    }
}
