import uuid
from datetime import datetime
from backend.database import get_connection


class ConversationStore:
    def create_conversation(self, title: str = "New Chat") -> str:
        conv_id = str(uuid.uuid4())
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO conversations (id, title) VALUES (?, ?)",
                (conv_id, title),
            )
        return conv_id

    def list_conversations(self) -> list[dict]:
        with get_connection() as conn:
            rows = conn.execute("""
                SELECT c.id, c.title, c.created_at,
                       COUNT(m.id) AS message_count
                FROM conversations c
                LEFT JOIN messages m ON m.conversation_id = c.id
                GROUP BY c.id
                ORDER BY c.created_at DESC
            """).fetchall()
        return [dict(r) for r in rows]

    def get_messages(self, conv_id: str) -> list[dict]:
        with get_connection() as conn:
            rows = conn.execute(
                "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at",
                (conv_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def add_message(self, conv_id: str, role: str, content: str) -> None:
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
                (conv_id, role, content),
            )

    def rename_conversation(self, conv_id: str, title: str) -> None:
        with get_connection() as conn:
            conn.execute(
                "UPDATE conversations SET title = ? WHERE id = ?",
                (title, conv_id),
            )

    def delete_conversation(self, conv_id: str) -> None:
        with get_connection() as conn:
            conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))

    def conversation_exists(self, conv_id: str) -> bool:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT 1 FROM conversations WHERE id = ?", (conv_id,)
            ).fetchone()
        return row is not None
