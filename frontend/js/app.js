class JarvisApp {
    constructor() {
        this._api = new JarvisAPI();
        this._speech = new SpeechManager();
        this._ui = new UIManager();

        this._convId = null;
        this._loading = false;

        this._inputBox = document.getElementById('inputBox');
        this._sendBtn = document.getElementById('sendBtn');
        this._micBtn = document.getElementById('micBtn');
        this._contextArea = document.getElementById('contextArea');
        this._newChatBtn = document.getElementById('newChatBtn');
        this._convList = document.getElementById('convList');
    }

    async init() {
        this._ui.setVoiceStatus(this._speech.isAvailable);
        if (!this._speech.isAvailable) this._micBtn.disabled = true;

        this._speech.onListeningChange(on => {
            this._micBtn.classList.toggle('active', on);
            this._ui.setMode(on ? 'listening' : 'idle');
        });
        this._speech.onSpeakingChange(on => {
            this._ui.setMode(on ? 'speaking' : 'idle');
        });

        this._bindEvents();

        const convos = await this._api.listConversations();
        if (convos.length > 0) {
            await this._loadConversation(convos[0].id, convos);
        } else {
            await this._createNewConversation();
        }
    }

    _bindEvents() {
        this._sendBtn.addEventListener('click', () => this._handleSend());

        this._inputBox.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._handleSend();
            }
        });

        this._inputBox.addEventListener('input', () => {
            this._inputBox.style.height = 'auto';
            this._inputBox.style.height =
                Math.min(this._inputBox.scrollHeight, 120) + 'px';
        });

        this._micBtn.addEventListener('click', () => {
            if (this._speech.isListening) {
                this._speech.stopListening();
            } else {
                this._speech.startListening(text => {
                    this._inputBox.value = text;
                    this._inputBox.style.height = 'auto';
                    this._inputBox.style.height =
                        Math.min(this._inputBox.scrollHeight, 120) + 'px';
                    this._handleSend();
                });
            }
        });

        this._newChatBtn.addEventListener('click', () => this._createNewConversation());

        // Window controls — only active when running inside Electron
        if (window.electron) {
            document.getElementById('windowControls').style.display = 'flex';
            document.getElementById('minimizeBtn').addEventListener('click', () => window.electron.minimize());
            document.getElementById('closeBtn').addEventListener('click', () => window.electron.close());
        }

        this._convList.addEventListener('click', e => {
            const del = e.target.closest('.conv-delete-btn');
            if (del) {
                e.stopPropagation();
                this._deleteConversation(del.dataset.id);
                return;
            }
            const item = e.target.closest('.conv-item');
            if (item && item.dataset.id !== this._convId) {
                this._loadConversation(item.dataset.id);
            }
        });
    }

    async _handleSend() {
        const text = this._inputBox.value.trim();
        if (!text || this._loading) return;

        this._inputBox.value = '';
        this._inputBox.style.height = 'auto';
        this._setLoading(true);

        this._ui.appendMessage('user', text);
        this._ui.setMode('thinking');

        const bubble = this._ui.startStreamingMessage();
        let fullReply = '';

        try {
            for await (const chunk of this._api.streamChat(
                this._convId, text, this._contextArea.value
            )) {
                fullReply += chunk;
                this._ui.updateStreamingMessage(bubble, fullReply);
            }
        } catch (err) {
            const fallback = "My apologies, sir. It appears my neural link is unavailable at the moment. Please verify the API key is configured and try again.";
            this._ui.updateStreamingMessage(bubble, fallback);
            this._speech.speak(fallback);
            this._ui.setMode('error');
        }

        this._ui.setMode('idle');
        this._setLoading(false);
        this._inputBox.focus();

        if (fullReply) this._speech.speak(fullReply);

        // Auto-title the conversation after the first exchange.
        await this._maybeAutoTitle(text);
    }

    async _createNewConversation() {
        const conv = await this._api.createConversation();
        this._convId = conv.id;
        this._ui.clearChat();
        this._ui.showWelcome();
        const convos = await this._api.listConversations();
        this._ui.renderConversationList(convos, this._convId);
        this._inputBox.focus();
    }

    async _loadConversation(convId, convos = null) {
        this._convId = convId;
        this._ui.clearChat();

        const [messages, list] = await Promise.all([
            this._api.getMessages(convId),
            convos ?? this._api.listConversations(),
        ]);

        this._ui.renderConversationList(list, convId);

        if (messages.length === 0) {
            this._ui.showWelcome();
        } else {
            for (const msg of messages) {
                // User messages stored with context prefix — strip it for display.
                const display = msg.content.replace(
                    /^\[CODE CONTEXT\][\s\S]*?\[QUESTION\]\n/,
                    ''
                );
                this._ui.appendMessage(
                    msg.role === 'assistant' ? 'jarvis' : 'user',
                    display
                );
            }
        }
        this._inputBox.focus();
    }

    async _deleteConversation(convId) {
        await this._api.deleteConversation(convId);

        if (convId === this._convId) {
            const convos = await this._api.listConversations();
            if (convos.length > 0) {
                await this._loadConversation(convos[0].id, convos);
            } else {
                await this._createNewConversation();
            }
        } else {
            const convos = await this._api.listConversations();
            this._ui.renderConversationList(convos, this._convId);
        }
    }

    async _maybeAutoTitle(firstMessage) {
        const convos = await this._api.listConversations();
        const current = convos.find(c => c.id === this._convId);
        if (!current || current.title !== 'New Chat') return;

        const title = firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '…' : '');
        await this._api.renameConversation(this._convId, title);

        const updated = await this._api.listConversations();
        this._ui.renderConversationList(updated, this._convId);
    }

    _setLoading(on) {
        this._loading = on;
        this._sendBtn.disabled = on;
    }
}

window.addEventListener('DOMContentLoaded', () => new JarvisApp().init());
