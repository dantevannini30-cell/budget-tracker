import os, json, math, urllib.request
from database import DEFAULT_USER_ID

EMBED_MODEL = "nomic-embed-text:latest"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
EMBED_URL = OLLAMA_URL.replace("/api/chat", "/api/embeddings").replace("/api/generate", "/api/embeddings")
OLLAMA_TIMEOUT_SECONDS = 60

def init_embeddings_db():
    import sqlite3
    conn = sqlite3.connect("embeddings.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transaction_embeddings (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            transaction_id TEXT,
            statement TEXT,
            embedding TEXT,
            created_at TEXT,
            PRIMARY KEY (user_id, transaction_id)
        )
    """)
    ensure_embeddings_user_scope(conn)
    conn.commit()
    conn.close()


def ensure_embeddings_user_scope(conn):
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(transaction_embeddings)")
    columns = [dict(zip(["cid", "name", "type", "notnull", "dflt_value", "pk"], row)) for row in cursor.fetchall()]
    if any(col["name"] == "user_id" and col["pk"] == 1 for col in columns):
        return

    user_expr = "COALESCE(user_id, ?)" if any(col["name"] == "user_id" for col in columns) else "?"
    cursor.execute("ALTER TABLE transaction_embeddings RENAME TO transaction_embeddings_legacy")
    cursor.execute("""
        CREATE TABLE transaction_embeddings (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            transaction_id TEXT,
            statement TEXT,
            embedding TEXT,
            created_at TEXT,
            PRIMARY KEY (user_id, transaction_id)
        )
    """)
    cursor.execute(f"""
        INSERT OR IGNORE INTO transaction_embeddings (
            user_id, transaction_id, statement, embedding, created_at
        )
        SELECT
            {user_expr},
            transaction_id,
            statement,
            embedding,
            created_at
        FROM transaction_embeddings_legacy
    """, (DEFAULT_USER_ID,))
    cursor.execute("DROP TABLE transaction_embeddings_legacy")


def get_cached_embedding(user_id, transaction_id):
    import sqlite3
    try:
        init_embeddings_db()
        conn = sqlite3.connect("embeddings.db")
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT embedding FROM transaction_embeddings WHERE user_id = ? AND transaction_id = ?",
            (user_id, transaction_id)
        ).fetchone()
        conn.close()
        if row:
            return json.loads(row["embedding"])
    except Exception as err:
        print(f"[embeddings] cache read failed: {err}")
    return None


def save_embedding(user_id, transaction_id, statement, embedding):
    import sqlite3
    from datetime import datetime, timezone
    try:
        init_embeddings_db()
        conn = sqlite3.connect("embeddings.db")
        conn.execute("""
            INSERT OR REPLACE INTO transaction_embeddings
                (user_id, transaction_id, statement, embedding, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            user_id,
            transaction_id,
            statement,
            json.dumps(embedding),
            datetime.now(timezone.utc).isoformat(timespec="seconds"),
        ))
        conn.commit()
        conn.close()
    except Exception as err:
        print(f"[embeddings] cache write failed: {err}")


def get_embedding(text, user_id=DEFAULT_USER_ID, transaction_id=None):
    if transaction_id:
        cached = get_cached_embedding(user_id, transaction_id)
        if cached:
            print(f"[embeddings] cache hit {transaction_id}")
            return cached

    payload = {"model": EMBED_MODEL, "prompt": text}
    request = urllib.request.Request(
        EMBED_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=OLLAMA_TIMEOUT_SECONDS) as response:
        data = json.loads(response.read().decode("utf-8"))
    embedding = data["embedding"]

    if transaction_id:
        save_embedding(user_id, transaction_id, text, embedding)
        print(f"[embeddings] cached {transaction_id}")

    return embedding


def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if not norm_a or not norm_b:
        return 0.0
    return dot / (norm_a * norm_b)


def get_similar_examples(statement, user_id=DEFAULT_USER_ID, transaction_id=None, amount=None, limit=5):
    from database import get_connection
    init_embeddings_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            t.id,
            t.statement,
            t.description,
            t.amount,
            t.date,
            c.category
        FROM transactions t
        JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
          AND c.status = 'accepted'
          AND c.category IS NOT NULL
          AND c.category != ''
        ORDER BY t.date DESC
    """, (user_id,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    if not rows:
        print("[embeddings] no accepted transactions to compare against")
        return []

    try:
        query_vec = get_embedding(statement, user_id=user_id, transaction_id=transaction_id)

        scored = []
        for row in rows:
            candidate_text = row["statement"] or row["description"] or ""
            if not candidate_text:
                continue
            candidate_vec = get_embedding(candidate_text, user_id=user_id, transaction_id=row["id"])
            score = cosine_similarity(query_vec, candidate_vec)
            scored.append((score, row))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = [row for _, row in scored[:limit]]
        print(f"[embeddings] top match score={scored[0][0]:.3f} category={scored[0][1]['category']!r}")

    except Exception as err:
        print(f"[embeddings] failed, falling back to recency: {err}")
        top = rows[:limit]

    return [
        {
            "statement": row["statement"] or row["description"] or "",
            "amount": row["amount"],
            "date": row["date"],
            "category": row["category"],
        }
        for row in top
    ]
