class JarvisAPI {
    async listInputDevices() {
        const response = await fetch('/api/speech/devices');
        if (!response.ok) throw new Error('Failed to fetch devices');
        return response.json();
    }

    async createConversation(title = 'New Chat') {
        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        if (!response.ok) throw new Error('Failed to create conversation');
        return response.json();
    }

    async listConversations() {
        const response = await fetch('/api/conversations');
        if (!response.ok) throw new Error('Failed to list conversations');
        return response.json();
    }

    async getMessages(conversationId) {
        const response = await fetch(`/api/conversations/${conversationId}/messages`);
        if (!response.ok) throw new Error('Failed to load messages');
        return response.json();
    }

    async renameConversation(conversationId, title) {
        const response = await fetch(`/api/conversations/${conversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        if (!response.ok) throw new Error('Failed to rename conversation');
    }

    async deleteConversation(conversationId) {
        const response = await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete conversation');
    }

    async *streamChat(conversationId, message, context = '') {
        const response = await fetch(`/api/conversations/${conversationId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, context }),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.detail || 'Chat request failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pendingData = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            pendingData += decoder.decode(value, { stream: true });
            const sseFrames = pendingData.split('\n\n');
            pendingData = sseFrames.pop();

            for (const frame of sseFrames) {
                if (!frame.startsWith('data: ')) continue;
                const payload = JSON.parse(frame.slice(6));
                if (payload.error) throw new Error('api_error');
                if (payload.done) return;
                yield payload.chunk;
            }
        }
    }
}
