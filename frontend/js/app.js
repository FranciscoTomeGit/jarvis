class JarvisApp {
    constructor() {
        this._api    = new JarvisAPI();
        this._speech = new SpeechManager();
        this._ui     = new UIManager();

        this._activeConversationId = null;
        this._loading = false;

        this._inputBox     = document.getElementById('inputBox');
        this._sendBtn      = document.getElementById('sendBtn');
        this._micBtn       = document.getElementById('micBtn');
        this._contextArea  = document.getElementById('contextArea');
        this._newChatBtn   = document.getElementById('newChatBtn');
        this._convList     = document.getElementById('convList');
        this._deviceSelect = document.getElementById('deviceSelect');
        this._callBtn      = document.getElementById('callBtn');
        this._callActive   = false;
    }

    async init() {
        this._ui.setVoiceStatus(this._speech.isAvailable);
        if (!this._speech.isAvailable) this._micBtn.disabled = true;

        this._speech.onListeningChange(isListening => {
            this._micBtn.classList.toggle('active', isListening);
            this._ui.setMode(isListening ? 'listening' : 'idle');
        });
        this._speech.onSpeakingChange(isSpeaking => {
            this._ui.setMode(isSpeaking ? 'speaking' : 'idle');
        });

        this._bindEvents();
        this._initCallMode();
        await this._initDeviceSelector();

        const conversations = await this._api.listConversations();
        if (conversations.length > 0) {
            await this._loadConversation(conversations[0].id, conversations);
        } else {
            await this._createNewConversation();
        }
    }

    // ── Event binding ─────────────────────────────────────────────────────────

    _bindEvents() {
        this._sendBtn.addEventListener('click', () => this._handleSend());

        this._inputBox.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this._handleSend();
            }
        });

        this._inputBox.addEventListener('input', () => this._resizeInputBox());

        this._micBtn.addEventListener('click', () => {
            if (this._speech.isListening) {
                this._speech.stopListening();
            } else {
                this._speech.startListening(text => {
                    this._inputBox.value = text;
                    this._resizeInputBox();
                    this._handleSend();
                });
            }
        });

        this._newChatBtn.addEventListener('click', () => this._createNewConversation());

        document.getElementById('speedControls').addEventListener('click', event => {
            const button = event.target.closest('.speed-btn');
            if (!button) return;
            const rate = parseFloat(button.dataset.rate);
            this._speech.setPlaybackRate(rate);
            document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });

        if (window.electron) {
            document.getElementById('windowControls').style.display = 'flex';
            document.getElementById('minimizeBtn').addEventListener('click', () => window.electron.minimize());
            document.getElementById('closeBtn').addEventListener('click', () => window.electron.close());
        }

        this._convList.addEventListener('click', event => {
            const deleteButton = event.target.closest('.conv-delete-btn');
            if (deleteButton) {
                event.stopPropagation();
                this._deleteConversation(deleteButton.dataset.id);
                return;
            }
            const item = event.target.closest('.conv-item');
            if (item && item.dataset.id !== this._activeConversationId) {
                this._loadConversation(item.dataset.id);
            }
        });
    }

    // ── Send / stream ─────────────────────────────────────────────────────────

    async _handleSend() {
        const text = this._inputBox.value.trim();
        if (!text || this._loading) return;

        this._inputBox.value = '';
        this._resizeInputBox();
        this._setLoading(true);

        this._ui.appendMessage('user', text);
        this._ui.setMode('thinking');

        const bubble = this._ui.createStreamingBubble();
        const fullReply = await this._streamReply(text, bubble);

        this._ui.setMode('idle');
        this._setLoading(false);
        this._inputBox.focus();

        if (fullReply) this._speech.speak(fullReply);

        await this._maybeAutoTitle(text);
    }

    async _streamReply(text, bubble) {
        try {
            let fullReply = '';
            for await (const chunk of this._api.streamChat(
                this._activeConversationId,
                text,
                this._contextArea.value
            )) {
                fullReply += chunk;
                this._ui.updateStreamingMessage(bubble, fullReply);
            }
            return fullReply;
        } catch {
            const fallback = "My apologies, sir. It appears my neural link is unavailable at the moment. Please verify the API key is configured and try again.";
            this._ui.updateStreamingMessage(bubble, fallback);
            this._speech.speak(fallback);
            this._ui.setMode('error');
            return '';
        }
    }

    // ── Conversation management ───────────────────────────────────────────────

    async _createNewConversation() {
        const conversation = await this._api.createConversation();
        this._activeConversationId = conversation.id;
        this._ui.clearChat();
        this._ui.showWelcome();
        const conversations = await this._api.listConversations();
        this._ui.renderConversationList(conversations, this._activeConversationId);
        this._inputBox.focus();
    }

    async _loadConversation(conversationId, conversations = null) {
        this._activeConversationId = conversationId;
        this._ui.clearChat();

        const [messages, conversationList] = await Promise.all([
            this._api.getMessages(conversationId),
            conversations ?? this._api.listConversations(),
        ]);

        this._ui.renderConversationList(conversationList, conversationId);

        if (messages.length === 0) {
            this._ui.showWelcome();
        } else {
            for (const message of messages) {
                const display = message.content.replace(
                    /^\[CODE CONTEXT\][\s\S]*?\[QUESTION\]\n/, ''
                );
                this._ui.appendMessage(message.role === 'assistant' ? 'jarvis' : 'user', display);
            }
        }
        this._inputBox.focus();
    }

    async _deleteConversation(conversationId) {
        await this._api.deleteConversation(conversationId);
        const conversations = await this._api.listConversations();

        if (conversationId === this._activeConversationId) {
            if (conversations.length > 0) {
                await this._loadConversation(conversations[0].id, conversations);
            } else {
                await this._createNewConversation();
            }
        } else {
            this._ui.renderConversationList(conversations, this._activeConversationId);
        }
    }

    async _maybeAutoTitle(firstMessage) {
        const conversations = await this._api.listConversations();
        const current = conversations.find(c => c.id === this._activeConversationId);
        if (!current || current.title !== 'New Chat') return;

        const title = firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '…' : '');
        await this._api.renameConversation(this._activeConversationId, title);

        current.title = title;
        this._ui.renderConversationList(conversations, this._activeConversationId);
    }

    // ── Call mode ─────────────────────────────────────────────────────────────

    _initCallMode() {
        this._api.subscribeToCallEvents(event => this._handleCallEvent(event));

        this._callBtn.addEventListener('click', async () => {
            if (this._callActive) {
                await this._api.endCall();
            } else {
                await this._api.startCall();
            }
        });
    }

    _handleCallEvent(event) {
        switch (event.type) {
            case 'call_started':
                this._callActive = true;
                this._ui.setCallActive(true);
                this._activeConversationId = event.conversationId;
                this._ui.clearChat();
                break;

            case 'state':
                this._ui.setMode(event.value);
                break;

            case 'message':
                this._ui.appendMessage(
                    event.role === 'assistant' ? 'jarvis' : 'user',
                    event.text
                );
                break;

            case 'call_ended':
                this._callActive = false;
                this._ui.setCallActive(false);
                this._ui.setMode('idle');
                this._api.listConversations().then(conversations => {
                    this._ui.renderConversationList(conversations, this._activeConversationId);
                });
                break;
        }
    }

    // ── Device selector ───────────────────────────────────────────────────────

    async _initDeviceSelector() {
        if (!window.electron) {
            this._deviceSelect.closest('.device-section').style.display = 'none';
            return;
        }

        try {
            const devices = await this._api.listInputDevices();
            console.log('[Devices] Found:', devices.map(device => `${device.index}: ${device.name}`));
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.index;
                option.textContent = device.name;
                this._deviceSelect.appendChild(option);
            });

            const savedDevice = localStorage.getItem('jarvis_input_device');
            if (savedDevice !== null) {
                this._deviceSelect.value = savedDevice;
                this._speech.setDevice(savedDevice === '' ? null : Number(savedDevice));
            }
        } catch (error) {
            console.error('[Devices] Failed to load input devices:', error);
        }

        this._deviceSelect.addEventListener('change', () => {
            const selectedValue = this._deviceSelect.value;
            localStorage.setItem('jarvis_input_device', selectedValue);
            this._speech.setDevice(selectedValue === '' ? null : Number(selectedValue));
            console.log('[Mic] Device changed to:', selectedValue || 'default');
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _resizeInputBox() {
        this._inputBox.style.height = 'auto';
        this._inputBox.style.height = Math.min(this._inputBox.scrollHeight, 120) + 'px';
    }

    _setLoading(isLoading) {
        this._loading = isLoading;
        this._sendBtn.disabled = isLoading;
    }
}

window.addEventListener('DOMContentLoaded', () => new JarvisApp().init());
