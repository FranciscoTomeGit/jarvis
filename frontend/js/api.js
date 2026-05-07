class JarvisAPI {
    async createConversation(title = 'New Chat') {
        const res = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        if (!res.ok) throw new Error('Failed to create conversation');
        return res.json();
    }

    async listConversations() {
        const res = await fetch('/api/conversations');
        if (!res.ok) throw new Error('Failed to list conversations');
        return res.json();
    }

    async getMessages(convId) {
        const res = await fetch(`/api/conversations/${convId}/messages`);
        if (!res.ok) throw new Error('Failed to load messages');
        return res.json();
    }

    async renameConversation(convId, title) {
        const res = await fetch(`/api/conversations/${convId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        if (!res.ok) throw new Error('Failed to rename conversation');
    }

    async deleteConversation(convId) {
        const res = await fetch(`/api/conversations/${convId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete conversation');
    }

    // Async generator that yields text chunks from the SSE stream.
    async *streamChat(convId, message, context = '') {
        const res = await fetch(`/api/conversations/${convId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, context }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Chat request failed');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop();

            for (const part of parts) {
                if (!part.startsWith('data: ')) continue;
                const payload = JSON.parse(part.slice(6));
                if (payload.error) throw new Error('api_error');
                if (payload.done) return;
                yield payload.chunk;
            }
        }
    }
}
