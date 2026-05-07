class UIManager {
    constructor() {
        this._messagesEl = document.getElementById('messages');
        this._equalizer = document.getElementById('equalizer');
        this._modeLabel = document.getElementById('modeLabel');
        this._voiceDot = document.getElementById('voiceDot');
        this._voiceLabel = document.getElementById('voiceLabel');
        this._convList = document.getElementById('convList');
    }

    // ── Mode / signal ────────────────────────────────────────────────────────

    setMode(mode) {
        this._equalizer.classList.remove('listening', 'speaking');
        const labels = {
            idle: 'STANDBY',
            listening: 'LISTENING...',
            thinking: 'PROCESSING...',
            speaking: 'SPEAKING...',
            error: 'ERROR',
        };
        if (mode === 'listening') this._equalizer.classList.add('listening');
        if (mode === 'speaking') this._equalizer.classList.add('speaking');
        this._modeLabel.textContent = labels[mode] ?? 'STANDBY';
    }

    setVoiceStatus(available) {
        if (available) {
            this._voiceDot.style.background = '#00ffaa';
            this._voiceDot.style.boxShadow = '0 0 6px #00ffaa';
            this._voiceLabel.textContent = 'VOICE READY';
        } else {
            this._voiceDot.classList.add('red');
            this._voiceLabel.textContent = 'NO VOICE';
        }
    }

    // ── Messages ─────────────────────────────────────────────────────────────

    clearChat() {
        this._messagesEl.innerHTML = '';
    }

    showWelcome() {
        this._messagesEl.innerHTML = `
            <div class="welcome" id="welcome">
                <div class="welcome-title">SYSTEM ONLINE</div>
                <div class="welcome-sub">ALL SYSTEMS NOMINAL · AWAITING INSTRUCTION</div>
                <div class="welcome-features">
                    <div class="feature">Ask anything</div>
                    <div class="feature">Code review</div>
                    <div class="feature">Voice input</div>
                    <div class="feature">Text to speech</div>
                    <div class="feature">Code context</div>
                </div>
            </div>`;
    }

    appendMessage(role, content) {
        this._removeWelcome();
        const div = this._buildMessageEl(role, content);
        this._messagesEl.appendChild(div);
        this._scrollToBottom();
        return div;
    }

    showTypingIndicator() {
        this._removeWelcome();
        const div = document.createElement('div');
        div.className = 'message jarvis';
        div.id = 'typing';

        const avatar = document.createElement('div');
        avatar.className = 'avatar jarvis';
        avatar.textContent = 'J';

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerHTML = `<div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>`;

        div.appendChild(avatar);
        div.appendChild(bubble);
        this._messagesEl.appendChild(div);
        this._scrollToBottom();
        return div;
    }

    removeTypingIndicator() {
        document.getElementById('typing')?.remove();
    }

    // Returns a live bubble element for in-place streaming updates.
    startStreamingMessage() {
        this._removeWelcome();
        const div = document.createElement('div');
        div.className = 'message jarvis';

        const avatar = document.createElement('div');
        avatar.className = 'avatar jarvis';
        avatar.textContent = 'J';

        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        div.appendChild(avatar);
        div.appendChild(bubble);
        this._messagesEl.appendChild(div);
        this._scrollToBottom();
        return bubble;
    }

    updateStreamingMessage(bubble, fullText) {
        bubble.innerHTML = this._formatContent(fullText);
        this._scrollToBottom();
    }

    // ── Conversation list ─────────────────────────────────────────────────────

    renderConversationList(conversations, activeId) {
        this._convList.innerHTML = '';
        for (const conv of conversations) {
            const item = document.createElement('div');
            item.className = 'conv-item' + (conv.id === activeId ? ' active' : '');
            item.dataset.id = conv.id;

            const title = document.createElement('span');
            title.className = 'conv-item-title';
            title.textContent = conv.title;

            const del = document.createElement('button');
            del.className = 'conv-delete-btn';
            del.textContent = '✕';
            del.title = 'Delete';
            del.dataset.id = conv.id;

            item.appendChild(title);
            item.appendChild(del);
            this._convList.appendChild(item);
        }
    }

    setActiveConversation(convId) {
        this._convList.querySelectorAll('.conv-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === convId);
        });
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    _removeWelcome() {
        document.getElementById('welcome')?.remove();
    }

    _buildMessageEl(role, content) {
        const div = document.createElement('div');
        div.className = `message ${role}`;

        const avatar = document.createElement('div');
        avatar.className = `avatar ${role}`;
        avatar.textContent = role === 'jarvis' ? 'J' : 'YOU';

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerHTML = this._formatContent(content);

        div.appendChild(avatar);
        div.appendChild(bubble);
        return div;
    }

    _formatContent(text) {
        return text
            .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) =>
                `<pre>${this._esc(code.trim())}</pre>`)
            .replace(/`([^`\n]+)`/g, (_, c) => `<code>${this._esc(c)}</code>`)
            .replace(/\n/g, '<br>');
    }

    _esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    _scrollToBottom() {
        this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
    }
}
