class UIManager {
    constructor() {
        this._messagesEl = document.getElementById('messages');
        this._equalizer  = document.getElementById('equalizer');
        this._modeLabel  = document.getElementById('modeLabel');
        this._voiceDot   = document.getElementById('voiceDot');
        this._voiceLabel = document.getElementById('voiceLabel');
        this._convList   = document.getElementById('convList');
        this._orb        = new JarvisOrb(document.getElementById('orbCanvas'));
    }

    // ── Mode / signal ────────────────────────────────────────────────────────

    setMode(mode) {
        this._equalizer.classList.remove('listening', 'speaking');
        const labels = {
            idle:      'STANDBY',
            listening: 'LISTENING...',
            thinking:  'PROCESSING...',
            speaking:  'SPEAKING...',
            error:     'ERROR',
        };
        if (mode === 'listening') this._equalizer.classList.add('listening');
        if (mode === 'speaking')  this._equalizer.classList.add('speaking');
        this._modeLabel.textContent = labels[mode] ?? 'STANDBY';
        this._orb.setState(mode);
    }

    setCallActive(isActive) {
        const indicator = document.getElementById('callIndicator');
        const button    = document.getElementById('callBtn');
        indicator.style.display = isActive ? 'flex' : 'none';
        button.classList.toggle('active', isActive);
        button.title = isActive ? 'End call' : "Start call — or say 'JARVIS'";
    }

    setVoiceStatus(isAvailable) {
        if (isAvailable) {
            this._voiceDot.style.background  = '#00ffaa';
            this._voiceDot.style.boxShadow   = '0 0 6px #00ffaa';
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
        const messageEl = this._buildMessageEl(role, content);
        this._messagesEl.appendChild(messageEl);
        this._scrollToBottom();
        return messageEl;
    }

    showTypingIndicator() {
        this._removeWelcome();
        const { wrapper, bubble } = this._createJarvisMessageFrame();
        wrapper.id = 'typing';
        bubble.innerHTML = `<div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>`;
        this._messagesEl.appendChild(wrapper);
        this._scrollToBottom();
        return wrapper;
    }

    removeTypingIndicator() {
        document.getElementById('typing')?.remove();
    }

    createStreamingBubble() {
        this._removeWelcome();
        const { wrapper, bubble } = this._createJarvisMessageFrame();
        this._messagesEl.appendChild(wrapper);
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
        for (const conversation of conversations) {
            this._convList.appendChild(this._buildConversationItem(conversation, activeId));
        }
    }

    setActiveConversation(conversationId) {
        this._convList.querySelectorAll('.conv-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === conversationId);
        });
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    _removeWelcome() {
        document.getElementById('welcome')?.remove();
    }

    _createJarvisMessageFrame() {
        const wrapper = document.createElement('div');
        wrapper.className = 'message jarvis';

        const avatar = document.createElement('div');
        avatar.className = 'avatar jarvis';
        avatar.textContent = 'J';

        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);
        return { wrapper, bubble };
    }

    _buildMessageEl(role, content) {
        const wrapper = document.createElement('div');
        wrapper.className = `message ${role}`;

        const avatar = document.createElement('div');
        avatar.className = `avatar ${role}`;
        avatar.textContent = role === 'jarvis' ? 'J' : 'YOU';

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerHTML = this._formatContent(content);

        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);
        return wrapper;
    }

    _buildConversationItem(conversation, activeId) {
        const item = document.createElement('div');
        item.className = 'conv-item' + (conversation.id === activeId ? ' active' : '');
        item.dataset.id = conversation.id;

        const titleEl = document.createElement('span');
        titleEl.className = 'conv-item-title';
        titleEl.textContent = conversation.title;

        const deleteButton = document.createElement('button');
        deleteButton.className = 'conv-delete-btn';
        deleteButton.textContent = '✕';
        deleteButton.title = 'Delete';
        deleteButton.dataset.id = conversation.id;

        item.appendChild(titleEl);
        item.appendChild(deleteButton);
        return item;
    }

    _formatContent(text) {
        return text
            .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _languageHint, code) =>
                `<pre>${this._escapeHtml(code.trim())}</pre>`)
            .replace(/`([^`\n]+)`/g, (_, inlineCode) =>
                `<code>${this._escapeHtml(inlineCode)}</code>`)
            .replace(/\n/g, '<br>');
    }

    _escapeHtml(rawText) {
        return rawText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    _scrollToBottom() {
        this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
    }
}
