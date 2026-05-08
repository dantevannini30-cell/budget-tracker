import sqlite3
import uuid
from datetime import date, datetime, timedelta
import json
import math
import urllib.request
import urllib.error
import os

from transaction_identity import get_external_transaction_id, get_transaction_id

DB_FILE = "transactions.db"


# ---------------------------
# CONNECTION
# ---------------------------

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saving_goals (
            id TEXT PRIMARY KEY,
            name TEXT,
            target_amount REAL,
            current_amount REAL,
            start_date TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS spending_targets (
            id TEXT PRIMARY KEY,
            name TEXT,
            amount REAL,
            period TEXT,
            start_date TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS spending_target_categories (
            target_id TEXT,
            category TEXT,
            PRIMARY KEY (target_id, category)
        )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        amount REAL,
        category TEXT,
        date TEXT,
        description TEXT,
        statement TEXT,
        account_id TEXT,
        account_name TEXT,
        balance REAL
    )
""")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transaction_classifications (
            transaction_id TEXT PRIMARY KEY,
            category TEXT,
            source TEXT,
            status TEXT,
            updated_at TEXT,
            updated_by TEXT
        )
    """)

    ensure_column(cursor, "saving_goals", "start_date", "TEXT")
    ensure_column(cursor, "saving_goals", "account_id", "TEXT")
    ensure_column(cursor, "spending_targets", "start_date", "TEXT")
    ensure_column(cursor, "transactions", "account_name", "TEXT")
    ensure_column(cursor, "transaction_classifications", "status", "TEXT")

    backfill_transaction_classifications(cursor)
    backfill_classification_status(cursor)
    conn.commit()
    conn.close()


def ensure_column(cursor, table_name, column_name, column_type):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = {row["name"] for row in cursor.fetchall()}

    if column_name not in columns:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")


def now_iso():
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def backfill_transaction_classifications(cursor):
    cursor.execute("""
        INSERT OR IGNORE INTO transaction_classifications (
            transaction_id, category, source, status, updated_at, updated_by
        )
        SELECT
            id,
            COALESCE(category, ''),
            CASE
                WHEN category IS NULL OR category = '' THEN 'unset'
                ELSE 'legacy'
            END,
            CASE
                WHEN category IS NULL OR category = '' THEN 'unset'
                ELSE 'accepted'
            END,
            ?,
            NULL
        FROM transactions
    """, (now_iso(),))


def backfill_classification_status(cursor):
    cursor.execute("""
        UPDATE transaction_classifications
        SET status = CASE
            WHEN source = 'unset' THEN 'unset'
            WHEN source = 'classifier' THEN 'suggested'
            WHEN source IN ('human', 'legacy') THEN 'accepted'
            ELSE 'unset'
        END
        WHERE status IS NULL
        OR status = ''
    """)


def upsert_transaction_classification(
    cursor,
    transaction_id,
    category="",
    source="unset",
    status="unset",
    updated_by=None,
):
    cursor.execute("""
        INSERT INTO transaction_classifications (
            transaction_id, category, source, status, updated_at, updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(transaction_id) DO UPDATE SET
            category = excluded.category,
            source = excluded.source,
            status = excluded.status,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
    """, (
        transaction_id,
        category or "",
        source,
        status,
        now_iso(),
        updated_by,
    ))


def ingest_transactions(transactions):
    conn = get_connection()
    cursor = conn.cursor()
    inserted_ids = []

    for txn in transactions:
        external_txn_id = get_external_transaction_id(txn)
        txn_id = get_transaction_id(txn)

        if not external_txn_id:
            cursor.execute("""
                SELECT id
                FROM transactions
                WHERE date = ?
                AND amount = ?
                AND statement = ?
                AND COALESCE(account_id, '') = ?
                LIMIT 1
            """, (
                txn.get("date"),
                txn.get("amount"),
                txn.get("statement", ""),
                txn.get("_account", ""),
            ))
            if cursor.fetchone():
                continue

        cursor.execute("""
        INSERT OR IGNORE INTO transactions (
            id, date, amount, description,
            category, statement, account_id, account_name, balance
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            txn_id,
            txn.get("date"),
            txn.get("amount"),
            txn.get("description", ""),
            txn.get("category", ""),
            txn.get("statement", ""),
            txn.get("_account", ""),
            txn.get("account_name", ""),
            txn.get("balance", 0),
        ))

        if cursor.rowcount:
            inserted_ids.append(txn_id)
            upsert_transaction_classification(
                cursor,
                txn_id,
                txn.get("category", ""),
                "classifier" if txn.get("category") else "unset",
                "suggested" if txn.get("category") else "unset",
                "classifier" if txn.get("category") else None,
            )
        else:
            cursor.execute("""
                UPDATE transactions
                SET
                    account_id = CASE
                        WHEN (account_id IS NULL OR account_id = '') THEN ?
                        ELSE account_id
                    END,
                    account_name = CASE
                        WHEN (account_name IS NULL OR account_name = '') THEN ?
                        ELSE account_name
                    END,
                    balance = COALESCE(?, balance)
                WHERE id = ?
            """, (
                txn.get("_account", ""),
                txn.get("account_name", ""),
                txn.get("balance"),
                txn_id,
            ))

    conn.commit()
    conn.close()

    return inserted_ids


def get_latest_transaction_date():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT MAX(date) AS latest_date FROM transactions")
    row = cursor.fetchone()

    conn.close()

    return row["latest_date"] if row else None


def get_accounts():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            account_id,
            COUNT(*) AS transaction_count,
            MAX(date) AS latest_date
        FROM transactions
        WHERE account_id IS NOT NULL
        AND account_id != ''
        GROUP BY account_id
        ORDER BY latest_date DESC
    """)

    accounts = []
    for row in cursor.fetchall():
        latest = get_latest_account_transaction(cursor, row["account_id"])
        accounts.append({
            "id": row["account_id"],
            "name": (latest or {}).get("account_name") or row["account_id"],
            "transaction_count": row["transaction_count"],
            "latest_date": (latest or {}).get("date") or row["latest_date"],
            "latest_balance": latest["balance"] if latest else None,
        })

    conn.close()
    return accounts


def get_account_transactions(account_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            t.*,
            COALESCE(NULLIF(c.category, ''), t.category, '') AS category,
            COALESCE(c.source, 'unset') AS category_source,
            COALESCE(c.status, 'unset') AS category_status,
            c.updated_at AS category_updated_at,
            c.updated_by AS category_updated_by
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        WHERE t.account_id = ?
        ORDER BY t.date DESC
    """, (account_id,))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def get_transactions():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT
        t.id,
        t.amount,
        t.date,
        t.description,
        t.statement,
        t.account_id,
        t.account_name,
        t.balance,
        COALESCE(NULLIF(c.category, ''), t.category, '') AS category,
        COALESCE(c.source, 'unset') AS category_source,
        COALESCE(c.status, 'unset') AS category_status,
        c.updated_at AS category_updated_at,
        c.updated_by AS category_updated_by
    FROM transactions t
    LEFT JOIN transaction_classifications c
        ON c.transaction_id = t.id
    WHERE LOWER(COALESCE(t.statement, t.description)) NOT LIKE '%transfer%'
    ORDER BY t.date DESC
""")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def set_transaction_category(transaction_id, category, source="human", updated_by="user"):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            t.id,
            COALESCE(c.category, '') AS current_category,
            COALESCE(c.status, 'unset') AS current_status
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        WHERE t.id = ?
    """, (transaction_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    current_category = row["current_category"] or ""
    current_status = row["current_status"] or "unset"
    normalized_category = category or ""

    if current_status == "suggested":
        status = "accepted" if normalized_category == current_category else "rejected"
    else:
        status = "accepted" if normalized_category else "unset"

    upsert_transaction_classification(
        cursor,
        transaction_id,
        normalized_category,
        source,
        status,
        updated_by,
    )

    conn.commit()
    conn.close()
    return True


def accept_transaction_category(transaction_id, updated_by="user"):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT category
        FROM transaction_classifications
        WHERE transaction_id = ?
        AND category IS NOT NULL
        AND category != ''
    """, (transaction_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return False

    upsert_transaction_classification(
        cursor,
        transaction_id,
        row["category"],
        "classifier",
        "accepted",
        updated_by,
    )

    conn.commit()
    conn.close()
    return True


def classify_unset_transactions(limit=None):
    from classifier import classify_transaction, is_classifier_available

    print(f"[classifier] classify_unset_transactions start limit={limit}")

    if not is_classifier_available():
        print("[classifier] abort: Ollama is not available")
        return []

    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT t.*
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        WHERE COALESCE(c.status, 'unset') = 'unset'
        ORDER BY t.date DESC
    """
    params = []

    if limit:
        query += " LIMIT ?"
        params.append(limit)

    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    print(f"[classifier] found {len(rows)} unset transactions")

    # classify all rows with no DB connection open
    results = []
    for row in rows:
        category = classify_transaction(row)
        if not category:
            print(f"[classifier] no category suggested for {row['id']}")
            continue
        results.append({
            "id": row["id"],
            "category": category,
        })
        print(f"[classifier] suggested {row['id']} -> {category!r}")

    if not results:
        print("[classifier] done classified=0")
        return []

    # single write pass
    conn = get_connection()
    cursor = conn.cursor()

    for r in results:
        upsert_transaction_classification(
            cursor,
            r["id"],
            r["category"],
            "classifier",
            "suggested",
            "classifier",
        )

    conn.commit()
    conn.close()

    print(f"[classifier] done classified={len(results)}")
    return results

def get_latest_account_transaction(cursor, account_id):
    cursor.execute("""
        SELECT balance, date, account_name
        FROM transactions
        WHERE account_id = ?
        AND balance IS NOT NULL
        ORDER BY date DESC
        LIMIT 1
    """, (account_id,))

    row = cursor.fetchone()
    return dict(row) if row else None


# ---------------------------
# SPENDING TARGETS
# ---------------------------

def today_iso():
    return date.today().isoformat()


def create_spending_target(name, amount, period, categories, start_date=None):
    conn = get_connection()
    cursor = conn.cursor()

    target_id = uuid.uuid4().hex
    start_date = start_date or today_iso()

    cursor.execute("""
        INSERT INTO spending_targets (id, name, amount, period, start_date)
        VALUES (?, ?, ?, ?, ?)
    """, (target_id, name, amount, period, start_date))

    for c in categories:
        cursor.execute("""
            INSERT OR IGNORE INTO spending_target_categories (target_id, category)
            VALUES (?, ?)
        """, (target_id, c))

    conn.commit()
    conn.close()

    return {
        "id": target_id,
        "name": name,
        "amount": amount,
        "period": period,
        "start_date": start_date,
        "categories": categories,
    }


def update_spending_target(target_id, name, amount, period, categories, start_date=None):
    conn = get_connection()
    cursor = conn.cursor()
    start_date = start_date or today_iso()

    cursor.execute("""
        UPDATE spending_targets
        SET name = ?, amount = ?, period = ?, start_date = ?
        WHERE id = ?
    """, (name, amount, period, start_date, target_id))

    if cursor.rowcount == 0:
        conn.close()
        return None

    cursor.execute("""
        DELETE FROM spending_target_categories
        WHERE target_id = ?
    """, (target_id,))

    for category in categories:
        cursor.execute("""
            INSERT OR IGNORE INTO spending_target_categories (target_id, category)
            VALUES (?, ?)
        """, (target_id, category))

    conn.commit()
    conn.close()

    return {
        "id": target_id,
        "name": name,
        "amount": amount,
        "period": period,
        "start_date": start_date,
        "categories": categories,
    }


def get_spending_targets():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM spending_targets")
    targets = [dict(r) for r in cursor.fetchall()]

    for t in targets:
        cursor.execute("""
            SELECT category
            FROM spending_target_categories
            WHERE target_id = ?
        """, (t["id"],))

        t["categories"] = [r["category"] for r in cursor.fetchall()]

    conn.close()
    return targets


# ---------------------------
# SAVING GOALS
# ---------------------------

def create_saving_goal(name, target_amount, current_amount=0, start_date=None, account_id=None):
    conn = get_connection()
    cursor = conn.cursor()

    goal_id = uuid.uuid4().hex
    start_date = start_date or today_iso()

    cursor.execute("""
        INSERT INTO saving_goals (id, name, target_amount, current_amount, start_date, account_id)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (goal_id, name, target_amount, current_amount, start_date, account_id))

    conn.commit()
    conn.close()

    return {
        "id": goal_id,
        "name": name,
        "target_amount": target_amount,
        "current_amount": current_amount,
        "start_date": start_date,
        "account_id": account_id,
    }


def update_saving_goal(goal_id, name, target_amount, current_amount=0, start_date=None, account_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    start_date = start_date or today_iso()

    cursor.execute("""
        UPDATE saving_goals
        SET name = ?, target_amount = ?, current_amount = ?, start_date = ?, account_id = ?
        WHERE id = ?
    """, (name, target_amount, current_amount, start_date, account_id, goal_id))

    if cursor.rowcount == 0:
        conn.close()
        return None

    conn.commit()
    conn.close()

    return {
        "id": goal_id,
        "name": name,
        "target_amount": target_amount,
        "current_amount": current_amount,
        "start_date": start_date,
        "account_id": account_id,
    }


def get_saving_goals():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM saving_goals")
    goals = [dict(row) for row in cursor.fetchall()]

    for goal in goals:
        account_id = goal.get("account_id")
        if not account_id:
            continue

        latest = get_latest_account_transaction(cursor, account_id)
        if not latest:
            continue

        goal["account_name"] = latest.get("account_name") or account_id
        goal["account_latest_date"] = latest.get("date")
        goal["account_balance"] = latest.get("balance")
        goal["manual_current_amount"] = goal.get("current_amount")
        goal["current_amount"] = latest.get("balance") or 0

    conn.close()

    return goals


def get_spending_targets_with_progress():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM spending_targets")
    targets = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT target_id, category
        FROM spending_target_categories
    """)

    category_map = {}
    for row in cursor.fetchall():
        category_map.setdefault(row["target_id"], []).append(row["category"])

    result = []
    today = date.today()

    for target in targets:
        categories = category_map.get(target["id"], [])
        period_start = get_current_period_start(
            target.get("start_date"),
            target.get("period"),
            today,
        )
        spent = get_spent_for_categories(cursor, categories, period_start)
        amount = target["amount"]

        result.append({
            **target,
            "categories": categories,
            "period_start": period_start,
            "current_spent": spent,
            "remaining": amount - spent,
            "progress_pct": (spent / amount * 100) if amount else 0,
            "is_over": spent > amount,
        })

    conn.close()
    return result


def get_spent_for_categories(cursor, categories, start_date):
    if not categories:
        return 0

    placeholders = ",".join(["?"] * len(categories))
    cursor.execute(f"""
        SELECT COALESCE(SUM(ABS(t.amount)), 0) AS spent
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        WHERE t.amount < 0
        AND COALESCE(NULLIF(c.category, ''), t.category, '') IN ({placeholders})
        AND t.date >= ?
    """, categories + [start_date])

    return cursor.fetchone()["spent"] or 0


def get_current_period_start(start_date, period, today=None):
    today = today or date.today()
    anchor = parse_date(start_date) or today

    if anchor > today:
        return anchor.isoformat()

    if period == "weekly":
        elapsed_days = (today - anchor).days
        return (anchor + timedelta(days=(elapsed_days // 7) * 7)).isoformat()

    if period == "monthly":
        current = anchor
        while True:
            next_date = add_months(current, 1)
            if next_date > today:
                return current.isoformat()
            current = next_date

    if period == "yearly":
        current = anchor
        while True:
            next_date = add_years(current, 1)
            if next_date > today:
                return current.isoformat()
            current = next_date

    return anchor.isoformat()


def parse_date(value):
    if not value:
        return None

    try:
        return datetime.fromisoformat(value[:10]).date()
    except ValueError:
        return None


def add_months(value, months):
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, days_in_month(year, month))
    return date(year, month, day)


def add_years(value, years):
    year = value.year + years
    day = min(value.day, days_in_month(year, value.month))
    return date(year, value.month, day)


def days_in_month(year, month):
    if month == 12:
        return 31

    return (date(year, month + 1, 1) - timedelta(days=1)).day


def get_known_categories(limit=50):
    """Return distinct accepted category names, most frequently used first."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT category, COUNT(*) AS cnt
        FROM transaction_classifications
        WHERE status = 'accepted'
          AND category IS NOT NULL
          AND category != ''
        GROUP BY category
        ORDER BY cnt DESC
        LIMIT ?
    """, (limit,))

    categories = [row["category"] for row in cursor.fetchall()]
    conn.close()
    return categories


EMBED_MODEL = "nomic-embed-text:latest"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
EMBED_URL = OLLAMA_URL.replace("/api/chat", "/api/embeddings").replace("/api/generate", "/api/embeddings")
OLLAMA_TIMEOUT_SECONDS = 60

def init_embeddings_db():
    import sqlite3
    conn = sqlite3.connect("embeddings.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transaction_embeddings (
            transaction_id TEXT PRIMARY KEY,
            statement TEXT,
            embedding TEXT,
            created_at TEXT
        )
    """)
    conn.commit()
    conn.close()


def get_cached_embedding(transaction_id):
    import sqlite3
    try:
        conn = sqlite3.connect("embeddings.db")
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT embedding FROM transaction_embeddings WHERE transaction_id = ?",
            (transaction_id,)
        ).fetchone()
        conn.close()
        if row:
            return json.loads(row["embedding"])
    except Exception as err:
        print(f"[embeddings] cache read failed: {err}")
    return None


def save_embedding(transaction_id, statement, embedding):
    import sqlite3
    from datetime import datetime, timezone
    try:
        conn = sqlite3.connect("embeddings.db")
        conn.execute("""
            INSERT OR REPLACE INTO transaction_embeddings
                (transaction_id, statement, embedding, created_at)
            VALUES (?, ?, ?, ?)
        """, (
            transaction_id,
            statement,
            json.dumps(embedding),
            datetime.now(timezone.utc).isoformat(timespec="seconds"),
        ))
        conn.commit()
        conn.close()
    except Exception as err:
        print(f"[embeddings] cache write failed: {err}")


def get_embedding(text, transaction_id=None):
    if transaction_id:
        cached = get_cached_embedding(transaction_id)
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
        save_embedding(transaction_id, text, embedding)
        print(f"[embeddings] cached {transaction_id}")

    return embedding


def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if not norm_a or not norm_b:
        return 0.0
    return dot / (norm_a * norm_b)


def get_similar_examples(statement, transaction_id=None, amount=None, limit=5):
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
            ON c.transaction_id = t.id
        WHERE c.status = 'accepted'
          AND c.category IS NOT NULL
          AND c.category != ''
        ORDER BY t.date DESC
    """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    if not rows:
        print("[embeddings] no accepted transactions to compare against")
        return []

    try:
        query_vec = get_embedding(statement, transaction_id=transaction_id)

        scored = []
        for row in rows:
            candidate_text = row["statement"] or row["description"] or ""
            if not candidate_text:
                continue
            candidate_vec = get_embedding(candidate_text, transaction_id=row["id"])
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
