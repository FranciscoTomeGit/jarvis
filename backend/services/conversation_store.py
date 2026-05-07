import uuid
from backend.database import get_connection


class ConversationStore:
    def create_conversation(self, title: str = "New Chat") -> str:
        conversation_id = str(uuid.uuid4())
        with get_connection() as connection:
            connection.execute(
                "INSERT INTO conversations (id, title) VALUES (?, ?)",
                (conversation_id, title),
            )
        return conversation_id

    def list_conversations(self) -> list[dict]:
        with get_connection() as connection:
            rows = connection.execute("""
                SELECT c.id, c.title, c.created_at,
                       COUNT(m.id) AS message_count
                FROM conversations c
                LEFT JOIN messages m ON m.conversation_id = c.id
                GROUP BY c.id
                ORDER BY c.created_at DESC
            """).fetchall()
        return [dict(row) for row in rows]

    def get_messages(self, conversation_id: str) -> list[dict]:
        with get_connection() as connection:
            rows = connection.execute(
                "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at",
                (conversation_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def add_message(self, conversation_id: str, role: str, content: str) -> None:
        with get_connection() as connection:
            connection.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
                (conversation_id, role, content),
            )

    def rename_conversation(self, conversation_id: str, title: str) -> bool:
        with get_connection() as connection:
            cursor = connection.execute(
                "UPDATE conversations SET title = ? WHERE id = ?",
                (title, conversation_id),
            )
        return cursor.rowcount > 0

    def delete_conversation(self, conversation_id: str) -> bool:
        with get_connection() as connection:
            cursor = connection.execute(
                "DELETE FROM conversations WHERE id = ?", (conversation_id,)
            )
        return cursor.rowcount > 0

    def conversation_exists(self, conversation_id: str) -> bool:
        with get_connection() as connection:
            row = connection.execute(
                "SELECT 1 FROM conversations WHERE id = ?", (conversation_id,)
            ).fetchone()
        return row is not None
