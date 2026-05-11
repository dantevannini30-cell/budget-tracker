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
DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"
DEFAULT_CLASSIFICATION_BATCH_SIZE = 10


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
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            display_name TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saving_goals (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            name TEXT,
            target_amount REAL,
            current_amount REAL,
            start_date TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS spending_targets (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            name TEXT,
            amount REAL,
            period TEXT,
            start_date TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS spending_target_categories (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            target_id TEXT,
            category TEXT,
            PRIMARY KEY (user_id, target_id, category)
        )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        id TEXT,
        amount REAL,
        category TEXT,
        date TEXT,
        description TEXT,
        statement TEXT,
        account_id TEXT,
        account_name TEXT,
        balance REAL,
        PRIMARY KEY (user_id, id)
    )
""")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transaction_classifications (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            transaction_id TEXT,
            category TEXT,
            source TEXT,
            status TEXT,
            updated_at TEXT,
            updated_by TEXT,
            PRIMARY KEY (user_id, transaction_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recurring_rules (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            name TEXT,
            type TEXT,
            period TEXT,
            category TEXT,
            statement_match TEXT,
            amount REAL,
            start_date TEXT,
            active INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS category_settings (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            category TEXT,
            is_recurring_expense INTEGER DEFAULT 0,
            is_income INTEGER DEFAULT 0,
            updated_at TEXT,
            PRIMARY KEY (user_id, category)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS account_settings (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            account_id TEXT,
            display_name TEXT,
            updated_at TEXT,
            PRIMARY KEY (user_id, account_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS debts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            name TEXT,
            initial_amount REAL,
            category TEXT,
            start_date TEXT,
            active INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS debt_payments (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            debt_id TEXT,
            amount REAL,
            payment_date TEXT,
            note TEXT,
            created_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transaction_allocations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            transaction_id TEXT,
            from_category TEXT,
            to_category TEXT,
            amount REAL,
            note TEXT,
            created_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS investments (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            name TEXT,
            type TEXT,
            start_date TEXT,
            active INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS investment_values (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            investment_id TEXT,
            amount REAL,
            value_date TEXT,
            note TEXT,
            source TEXT,
            created_at TEXT
        )
    """)

    seed_default_user(cursor)
    migrate_user_scoped_primary_keys(cursor)

    for table_name in (
        "saving_goals",
        "spending_targets",
        "spending_target_categories",
        "transactions",
        "transaction_classifications",
        "recurring_rules",
        "category_settings",
        "account_settings",
        "debts",
        "debt_payments",
        "transaction_allocations",
        "investments",
        "investment_values",
    ):
        ensure_column(
            cursor,
            table_name,
            "user_id",
            f"TEXT NOT NULL DEFAULT '{DEFAULT_USER_ID}'",
        )

    ensure_column(cursor, "saving_goals", "start_date", "TEXT")
    ensure_column(cursor, "saving_goals", "account_id", "TEXT")
    ensure_column(cursor, "spending_targets", "start_date", "TEXT")
    ensure_column(cursor, "transactions", "account_name", "TEXT")
    ensure_column(cursor, "transaction_classifications", "status", "TEXT")
    ensure_column(cursor, "recurring_rules", "active", "INTEGER DEFAULT 1")
    ensure_column(cursor, "recurring_rules", "created_at", "TEXT")
    ensure_column(cursor, "recurring_rules", "updated_at", "TEXT")
    ensure_column(cursor, "category_settings", "is_recurring_expense", "INTEGER DEFAULT 0")
    ensure_column(cursor, "category_settings", "is_income", "INTEGER DEFAULT 0")
    ensure_column(cursor, "category_settings", "updated_at", "TEXT")
    ensure_column(cursor, "account_settings", "display_name", "TEXT")
    ensure_column(cursor, "account_settings", "updated_at", "TEXT")
    ensure_column(cursor, "debts", "category", "TEXT")
    ensure_column(cursor, "debts", "start_date", "TEXT")
    ensure_column(cursor, "debts", "active", "INTEGER DEFAULT 1")
    ensure_column(cursor, "debts", "created_at", "TEXT")
    ensure_column(cursor, "debts", "updated_at", "TEXT")
    ensure_column(cursor, "transaction_allocations", "allocation_date", "TEXT")
    ensure_column(cursor, "investments", "type", "TEXT")
    ensure_column(cursor, "investments", "start_date", "TEXT")
    ensure_column(cursor, "investments", "active", "INTEGER DEFAULT 1")
    ensure_column(cursor, "investments", "created_at", "TEXT")
    ensure_column(cursor, "investments", "updated_at", "TEXT")
    ensure_column(cursor, "investment_values", "value_date", "TEXT")
    ensure_column(cursor, "investment_values", "note", "TEXT")
    ensure_column(cursor, "investment_values", "source", "TEXT")
    ensure_column(cursor, "investment_values", "created_at", "TEXT")

    backfill_user_ids(cursor)
    create_user_scoped_indexes(cursor)
    backfill_transaction_classifications(cursor)
    backfill_classification_status(cursor)
    conn.commit()
    conn.close()


def seed_default_user(cursor):
    timestamp = now_iso()
    cursor.execute("""
        INSERT INTO users (id, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            updated_at = users.updated_at
    """, (DEFAULT_USER_ID, "Local User", timestamp, timestamp))


def get_table_columns(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [dict(row) for row in cursor.fetchall()]


def table_exists(cursor, table_name):
    cursor.execute("""
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table'
        AND name = ?
    """, (table_name,))
    return cursor.fetchone() is not None


def migrate_user_scoped_primary_keys(cursor):
    migrate_transactions_table(cursor)
    migrate_transaction_classifications_table(cursor)
    migrate_account_settings_table(cursor)
    migrate_category_settings_table(cursor)
    migrate_spending_target_categories_table(cursor)


def migrate_transactions_table(cursor):
    columns = get_table_columns(cursor, "transactions")
    if any(col["name"] == "user_id" and col["pk"] == 1 for col in columns):
        return

    user_expr = "COALESCE(user_id, ?)" if any(col["name"] == "user_id" for col in columns) else "?"
    cursor.execute("ALTER TABLE transactions RENAME TO transactions_legacy")
    cursor.execute("""
        CREATE TABLE transactions (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            id TEXT,
            amount REAL,
            category TEXT,
            date TEXT,
            description TEXT,
            statement TEXT,
            account_id TEXT,
            account_name TEXT,
            balance REAL,
            PRIMARY KEY (user_id, id)
        )
    """)
    cursor.execute(f"""
        INSERT OR IGNORE INTO transactions (
            user_id, id, amount, category, date, description,
            statement, account_id, account_name, balance
        )
        SELECT
            {user_expr},
            id,
            amount,
            category,
            date,
            description,
            statement,
            account_id,
            account_name,
            balance
        FROM transactions_legacy
    """, (DEFAULT_USER_ID,))
    cursor.execute("DROP TABLE transactions_legacy")


def migrate_transaction_classifications_table(cursor):
    columns = get_table_columns(cursor, "transaction_classifications")
    if any(col["name"] == "user_id" and col["pk"] == 1 for col in columns):
        return

    user_expr = "COALESCE(user_id, ?)" if any(col["name"] == "user_id" for col in columns) else "?"
    cursor.execute("ALTER TABLE transaction_classifications RENAME TO transaction_classifications_legacy")
    cursor.execute("""
        CREATE TABLE transaction_classifications (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            transaction_id TEXT,
            category TEXT,
            source TEXT,
            status TEXT,
            updated_at TEXT,
            updated_by TEXT,
            PRIMARY KEY (user_id, transaction_id)
        )
    """)
    cursor.execute(f"""
        INSERT OR IGNORE INTO transaction_classifications (
            user_id, transaction_id, category, source, status, updated_at, updated_by
        )
        SELECT
            {user_expr},
            transaction_id,
            category,
            source,
            status,
            updated_at,
            updated_by
        FROM transaction_classifications_legacy
    """, (DEFAULT_USER_ID,))
    cursor.execute("DROP TABLE transaction_classifications_legacy")


def migrate_account_settings_table(cursor):
    columns = get_table_columns(cursor, "account_settings")
    if any(col["name"] == "user_id" and col["pk"] == 1 for col in columns):
        return

    user_expr = "COALESCE(user_id, ?)" if any(col["name"] == "user_id" for col in columns) else "?"
    cursor.execute("ALTER TABLE account_settings RENAME TO account_settings_legacy")
    cursor.execute("""
        CREATE TABLE account_settings (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            account_id TEXT,
            display_name TEXT,
            updated_at TEXT,
            PRIMARY KEY (user_id, account_id)
        )
    """)
    cursor.execute(f"""
        INSERT OR IGNORE INTO account_settings (
            user_id, account_id, display_name, updated_at
        )
        SELECT {user_expr}, account_id, display_name, updated_at
        FROM account_settings_legacy
    """, (DEFAULT_USER_ID,))
    cursor.execute("DROP TABLE account_settings_legacy")


def migrate_category_settings_table(cursor):
    columns = get_table_columns(cursor, "category_settings")
    if any(col["name"] == "user_id" and col["pk"] == 1 for col in columns):
        return

    user_expr = "COALESCE(user_id, ?)" if any(col["name"] == "user_id" for col in columns) else "?"
    cursor.execute("ALTER TABLE category_settings RENAME TO category_settings_legacy")
    cursor.execute("""
        CREATE TABLE category_settings (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            category TEXT,
            is_recurring_expense INTEGER DEFAULT 0,
            is_income INTEGER DEFAULT 0,
            updated_at TEXT,
            PRIMARY KEY (user_id, category)
        )
    """)
    cursor.execute(f"""
        INSERT OR IGNORE INTO category_settings (
            user_id, category, is_recurring_expense, is_income, updated_at
        )
        SELECT
            {user_expr},
            category,
            is_recurring_expense,
            is_income,
            updated_at
        FROM category_settings_legacy
    """, (DEFAULT_USER_ID,))
    cursor.execute("DROP TABLE category_settings_legacy")


def migrate_spending_target_categories_table(cursor):
    columns = get_table_columns(cursor, "spending_target_categories")
    if any(col["name"] == "user_id" and col["pk"] == 1 for col in columns):
        return

    user_expr = "COALESCE(user_id, ?)" if any(col["name"] == "user_id" for col in columns) else "?"
    cursor.execute("ALTER TABLE spending_target_categories RENAME TO spending_target_categories_legacy")
    cursor.execute("""
        CREATE TABLE spending_target_categories (
            user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            target_id TEXT,
            category TEXT,
            PRIMARY KEY (user_id, target_id, category)
        )
    """)
    cursor.execute(f"""
        INSERT OR IGNORE INTO spending_target_categories (user_id, target_id, category)
        SELECT {user_expr}, target_id, category
        FROM spending_target_categories_legacy
    """, (DEFAULT_USER_ID,))
    cursor.execute("DROP TABLE spending_target_categories_legacy")


def backfill_user_ids(cursor):
    for table_name in (
        "saving_goals",
        "spending_targets",
        "spending_target_categories",
        "transactions",
        "transaction_classifications",
        "recurring_rules",
        "category_settings",
        "account_settings",
        "debts",
        "debt_payments",
        "transaction_allocations",
        "investments",
        "investment_values",
    ):
        cursor.execute(
            f"UPDATE {table_name} SET user_id = ? WHERE user_id IS NULL OR user_id = ''",
            (DEFAULT_USER_ID,),
        )


def create_user_scoped_indexes(cursor):
    statements = [
        "CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON transactions(user_id, account_id)",
        "CREATE INDEX IF NOT EXISTS idx_transaction_classifications_user_txn ON transaction_classifications(user_id, transaction_id)",
        "CREATE INDEX IF NOT EXISTS idx_account_settings_user_account ON account_settings(user_id, account_id)",
        "CREATE INDEX IF NOT EXISTS idx_category_settings_user_category ON category_settings(user_id, category)",
        "CREATE INDEX IF NOT EXISTS idx_spending_target_categories_user_target ON spending_target_categories(user_id, target_id)",
        "CREATE INDEX IF NOT EXISTS idx_recurring_rules_user_category ON recurring_rules(user_id, category)",
        "CREATE INDEX IF NOT EXISTS idx_debts_user_active ON debts(user_id, active)",
        "CREATE INDEX IF NOT EXISTS idx_transaction_allocations_user_date ON transaction_allocations(user_id, allocation_date)",
        "CREATE INDEX IF NOT EXISTS idx_investments_user_active ON investments(user_id, active)",
        "CREATE INDEX IF NOT EXISTS idx_investment_values_user_investment_date ON investment_values(user_id, investment_id, value_date)",
    ]

    for statement in statements:
        cursor.execute(statement)


def ensure_column(cursor, table_name, column_name, column_type):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = {row["name"] for row in cursor.fetchall()}

    if column_name not in columns:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")


def now_iso():
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def backfill_transaction_classifications(cursor, user_id=None):
    query = """
        INSERT OR IGNORE INTO transaction_classifications (
            user_id, transaction_id, category, source, status, updated_at, updated_by
        )
        SELECT
            user_id,
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
    """
    params = [now_iso()]

    if user_id:
        query += " WHERE user_id = ?"
        params.append(user_id)

    cursor.execute(query, params)


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
    user_id,
    transaction_id,
    category="",
    source="unset",
    status="unset",
    updated_by=None,
):
    cursor.execute("""
        INSERT INTO transaction_classifications (
            user_id, transaction_id, category, source, status, updated_at, updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, transaction_id) DO UPDATE SET
            category = excluded.category,
            source = excluded.source,
            status = excluded.status,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
    """, (
        user_id,
        transaction_id,
        category or "",
        source,
        status,
        now_iso(),
        updated_by,
    ))


def ingest_transactions(transactions, user_id=DEFAULT_USER_ID):
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
                WHERE user_id = ?
                AND date = ?
                AND amount = ?
                AND statement = ?
                AND COALESCE(account_id, '') = ?
                LIMIT 1
            """, (
                user_id,
                txn.get("date"),
                txn.get("amount"),
                txn.get("statement", ""),
                txn.get("_account", ""),
            ))
            if cursor.fetchone():
                continue

        cursor.execute("""
        INSERT OR IGNORE INTO transactions (
            user_id, id, date, amount, description,
            category, statement, account_id, account_name, balance
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
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
                user_id,
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
                AND user_id = ?
            """, (
                txn.get("_account", ""),
                txn.get("account_name", ""),
                txn.get("balance"),
                txn_id,
                user_id,
            ))

    conn.commit()
    conn.close()

    return inserted_ids


def get_latest_transaction_date(user_id=DEFAULT_USER_ID):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT MAX(date) AS latest_date FROM transactions WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()

    conn.close()

    return row["latest_date"] if row else None


def get_accounts(user_id=DEFAULT_USER_ID):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            account_id,
            COUNT(*) AS transaction_count,
            MAX(date) AS latest_date
        FROM transactions
        WHERE user_id = ?
        AND account_id IS NOT NULL
        AND account_id != ''
        GROUP BY account_id
        ORDER BY latest_date DESC
    """, (user_id,))

    accounts = []
    for row in cursor.fetchall():
        latest = get_latest_account_transaction(cursor, user_id, row["account_id"])
        cursor.execute("""
            SELECT display_name
            FROM account_settings
            WHERE user_id = ?
            AND account_id = ?
        """, (user_id, row["account_id"]))
        settings = cursor.fetchone()
        display_name = settings["display_name"] if settings else None

        accounts.append({
            "id": row["account_id"],
            "name": display_name or (latest or {}).get("account_name") or row["account_id"],
            "source_name": (latest or {}).get("account_name") or row["account_id"],
            "transaction_count": row["transaction_count"],
            "latest_date": (latest or {}).get("date") or row["latest_date"],
            "latest_balance": latest["balance"] if latest else None,
        })

    conn.close()
    return accounts


def update_account_name(user_id, account_id, display_name):
    account_id = (account_id or "").strip()
    display_name = (display_name or "").strip()

    if not account_id:
        return None

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 1
        FROM transactions
        WHERE user_id = ?
        AND account_id = ?
        LIMIT 1
    """, (user_id, account_id))
    if not cursor.fetchone():
        conn.close()
        return None

    cursor.execute("""
        INSERT INTO account_settings (user_id, account_id, display_name, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, account_id) DO UPDATE SET
            display_name = excluded.display_name,
            updated_at = excluded.updated_at
    """, (user_id, account_id, display_name, now_iso()))

    conn.commit()
    conn.close()

    return {
        "id": account_id,
        "name": display_name or account_id,
    }


def get_account_transactions(user_id, account_id):
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
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        AND t.account_id = ?
        ORDER BY t.date DESC
    """, (user_id, account_id))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def get_transactions(user_id=DEFAULT_USER_ID):
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
        ON c.user_id = t.user_id
        AND c.transaction_id = t.id
    WHERE t.user_id = ?
    AND LOWER(COALESCE(t.statement, t.description)) NOT LIKE '%transfer%'
    ORDER BY t.date DESC
""", (user_id,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def set_transaction_category(user_id, transaction_id, category, source="human", updated_by="user"):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            t.id,
            COALESCE(c.category, '') AS current_category,
            COALESCE(c.status, 'unset') AS current_status
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        AND t.id = ?
    """, (user_id, transaction_id))
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
        user_id,
        transaction_id,
        normalized_category,
        source,
        status,
        updated_by,
    )

    conn.commit()
    conn.close()
    return True


def accept_transaction_category(user_id, transaction_id, updated_by="user"):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT category
        FROM transaction_classifications
        WHERE user_id = ?
        AND transaction_id = ?
        AND category IS NOT NULL
        AND category != ''
    """, (user_id, transaction_id))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return False

    upsert_transaction_classification(
        cursor,
        user_id,
        transaction_id,
        row["category"],
        "human",
        "accepted",
        updated_by,
    )

    conn.commit()
    conn.close()
    return True


def accept_all_suggested_transaction_categories(user_id, updated_by="user"):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE transaction_classifications
        SET
            source = 'human',
            status = 'accepted',
            updated_at = ?,
            updated_by = ?
        WHERE source = 'classifier'
        AND user_id = ?
        AND status = 'suggested'
        AND category IS NOT NULL
        AND category != ''
    """, (now_iso(), updated_by, user_id))

    accepted_count = cursor.rowcount
    conn.commit()
    conn.close()
    return accepted_count


def write_classifier_batch(user_id, results):
    if not results:
        return

    conn = get_connection()
    cursor = conn.cursor()

    for r in results:
        upsert_transaction_classification(
            cursor,
            user_id,
            r["id"],
            r["category"],
            "classifier",
            "suggested",
            "classifier",
        )

    conn.commit()
    conn.close()


def classify_unset_transactions(user_id, limit=None, batch_size=DEFAULT_CLASSIFICATION_BATCH_SIZE):
    from classifier import classify_transaction, is_classifier_available

    print(f"[classifier] classify_unset_transactions start limit={limit} batch_size={batch_size}")

    if not is_classifier_available():
        print("[classifier] abort: Ollama is not available")
        return []

    batch_size = batch_size or DEFAULT_CLASSIFICATION_BATCH_SIZE
    batch_size = max(1, int(batch_size))

    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT t.*
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        AND (
            COALESCE(c.status, 'unset') = 'unset'
            OR c.source = 'classifier'
        )
        ORDER BY t.date DESC
    """
    params = [user_id]

    if limit:
        query += " LIMIT ?"
        params.append(limit)

    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    print(f"[classifier] found {len(rows)} transactions to classify")

    results = []
    batch = []

    for row in rows:
        category = classify_transaction(row, user_id=user_id)
        if not category:
            print(f"[classifier] no category suggested for {row['id']}")
            continue

        result = {
            "id": row["id"],
            "category": category,
        }
        results.append(result)
        batch.append(result)
        print(f"[classifier] suggested {row['id']} -> {category!r}")

        if len(batch) >= batch_size:
            write_classifier_batch(user_id, batch)
            print(f"[classifier] wrote batch size={len(batch)}")
            batch = []

    if batch:
        write_classifier_batch(user_id, batch)
        print(f"[classifier] wrote batch size={len(batch)}")

    if not results:
        print("[classifier] done classified=0")
        return []

    print(f"[classifier] done classified={len(results)}")
    return results


def get_latest_account_transaction(cursor, user_id, account_id):
    cursor.execute("""
        SELECT balance, date, account_name
        FROM transactions
        WHERE user_id = ?
        AND account_id = ?
        AND balance IS NOT NULL
        ORDER BY date DESC
        LIMIT 1
    """, (user_id, account_id))

    row = cursor.fetchone()
    return dict(row) if row else None


def get_account_balance_history(user_id, account_id, period="weekly", count=8, today=None):
    if period not in {"weekly", "monthly", "yearly"}:
        raise ValueError("Unsupported history period")

    count = max(1, min(int(count or 8), 260))
    today = today or date.today()

    periods = []
    for index in range(count - 1, -1, -1):
        if period == "weekly":
            end_date = today - timedelta(days=index * 7)
            start_date = end_date - timedelta(days=6)
            label = end_date.strftime("%d %b")
        elif period == "monthly":
            end_date = add_months(today, -index)
            start_date = add_months(end_date, -1) + timedelta(days=1)
            label = end_date.strftime("%b %Y")
        else:
            end_date = add_years(today, -index)
            start_date = add_years(end_date, -1) + timedelta(days=1)
            label = end_date.strftime("%Y")

        periods.append({
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "label": label,
        })

    conn = get_connection()
    cursor = conn.cursor()

    result = []
    for item in periods:
        end_of_day = f"{item['end_date']}T23:59:59"
        cursor.execute("""
            SELECT balance, date
            FROM transactions
            WHERE user_id = ?
            AND account_id = ?
            AND balance IS NOT NULL
            AND date <= ?
            ORDER BY date DESC
            LIMIT 1
        """, (user_id, account_id, end_of_day))

        row = cursor.fetchone()
        result.append({
            **item,
            "balance": row["balance"] if row else None,
            "balance_date": row["date"] if row else None,
        })

    conn.close()
    return result


# ---------------------------
# SPENDING TARGETS
# ---------------------------

def today_iso():
    return date.today().isoformat()


def create_spending_target(user_id, name, amount, period, categories, start_date=None):
    conn = get_connection()
    cursor = conn.cursor()

    target_id = uuid.uuid4().hex
    start_date = start_date or today_iso()

    cursor.execute("""
        INSERT INTO spending_targets (id, user_id, name, amount, period, start_date)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (target_id, user_id, name, amount, period, start_date))

    for c in categories:
        cursor.execute("""
            INSERT OR IGNORE INTO spending_target_categories (user_id, target_id, category)
            VALUES (?, ?, ?)
        """, (user_id, target_id, c))

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


def update_spending_target(user_id, target_id, name, amount, period, categories, start_date=None):
    conn = get_connection()
    cursor = conn.cursor()
    start_date = start_date or today_iso()

    cursor.execute("""
        UPDATE spending_targets
        SET name = ?, amount = ?, period = ?, start_date = ?
        WHERE user_id = ?
        AND id = ?
    """, (name, amount, period, start_date, user_id, target_id))

    if cursor.rowcount == 0:
        conn.close()
        return None

    cursor.execute("""
        DELETE FROM spending_target_categories
        WHERE user_id = ?
        AND target_id = ?
    """, (user_id, target_id))

    for category in categories:
        cursor.execute("""
            INSERT OR IGNORE INTO spending_target_categories (user_id, target_id, category)
            VALUES (?, ?, ?)
        """, (user_id, target_id, category))

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


def get_spending_targets(user_id=DEFAULT_USER_ID):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM spending_targets WHERE user_id = ?", (user_id,))
    targets = [dict(r) for r in cursor.fetchall()]

    for t in targets:
        cursor.execute("""
            SELECT category
            FROM spending_target_categories
            WHERE user_id = ?
            AND target_id = ?
        """, (user_id, t["id"]))

        t["categories"] = [r["category"] for r in cursor.fetchall()]

    conn.close()
    return targets


# ---------------------------
# SAVING GOALS
# ---------------------------

def create_saving_goal(user_id, name, target_amount, current_amount=0, start_date=None, account_id=None):
    conn = get_connection()
    cursor = conn.cursor()

    goal_id = uuid.uuid4().hex
    start_date = start_date or today_iso()

    cursor.execute("""
        INSERT INTO saving_goals (id, user_id, name, target_amount, current_amount, start_date, account_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (goal_id, user_id, name, target_amount, current_amount, start_date, account_id))

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


def update_saving_goal(user_id, goal_id, name, target_amount, current_amount=0, start_date=None, account_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    start_date = start_date or today_iso()

    cursor.execute("""
        UPDATE saving_goals
        SET name = ?, target_amount = ?, current_amount = ?, start_date = ?, account_id = ?
        WHERE user_id = ?
        AND id = ?
    """, (name, target_amount, current_amount, start_date, account_id, user_id, goal_id))

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


def get_saving_goals(user_id=DEFAULT_USER_ID):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM saving_goals WHERE user_id = ?", (user_id,))
    goals = [dict(row) for row in cursor.fetchall()]

    for goal in goals:
        account_id = goal.get("account_id")
        if not account_id:
            continue

        latest = get_latest_account_transaction(cursor, user_id, account_id)
        if not latest:
            continue

        goal["account_name"] = latest.get("account_name") or account_id
        goal["account_latest_date"] = latest.get("date")
        goal["account_balance"] = latest.get("balance")
        goal["manual_current_amount"] = goal.get("current_amount")
        goal["current_amount"] = latest.get("balance") or 0

    conn.close()

    return goals


def get_spending_targets_with_progress(user_id=DEFAULT_USER_ID):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM spending_targets WHERE user_id = ?", (user_id,))
    targets = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT target_id, category
        FROM spending_target_categories
        WHERE user_id = ?
    """, (user_id,))

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
        spent = get_spent_for_categories(cursor, user_id, categories, period_start)
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


def create_recurring_rule(
    user_id,
    name,
    rule_type,
    period,
    category=None,
    statement_match=None,
    amount=None,
    start_date=None,
    active=True,
):
    conn = get_connection()
    cursor = conn.cursor()

    rule_id = uuid.uuid4().hex
    start_date = start_date or today_iso()
    timestamp = now_iso()
    rule_type = normalize_recurring_type(rule_type)
    period = normalize_recurring_period(period)
    category = (category or "").strip()
    statement_match = (statement_match or "").strip()

    cursor.execute("""
        INSERT INTO recurring_rules (
            id, user_id, name, type, period, category, statement_match,
            amount, start_date, active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        rule_id,
        user_id,
        name,
        rule_type,
        period,
        category,
        statement_match,
        amount,
        start_date,
        1 if active else 0,
        timestamp,
        timestamp,
    ))

    conn.commit()
    conn.close()

    return get_recurring_rule(user_id, rule_id)


def update_recurring_rule(
    user_id,
    rule_id,
    name,
    rule_type,
    period,
    category=None,
    statement_match=None,
    amount=None,
    start_date=None,
    active=True,
):
    conn = get_connection()
    cursor = conn.cursor()

    start_date = start_date or today_iso()
    rule_type = normalize_recurring_type(rule_type)
    period = normalize_recurring_period(period)
    category = (category or "").strip()
    statement_match = (statement_match or "").strip()

    cursor.execute("""
        UPDATE recurring_rules
        SET
            name = ?,
            type = ?,
            period = ?,
            category = ?,
            statement_match = ?,
            amount = ?,
            start_date = ?,
            active = ?,
            updated_at = ?
        WHERE id = ?
        AND user_id = ?
    """, (
        name,
        rule_type,
        period,
        category,
        statement_match,
        amount,
        start_date,
        1 if active else 0,
        now_iso(),
        rule_id,
        user_id,
    ))

    if cursor.rowcount == 0:
        conn.close()
        return None

    conn.commit()
    conn.close()
    return get_recurring_rule(user_id, rule_id)


def delete_recurring_rule(user_id, rule_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM recurring_rules
        WHERE user_id = ?
        AND id = ?
    """, (user_id, rule_id))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_recurring_rule(user_id, rule_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM recurring_rules
        WHERE user_id = ?
        AND id = ?
    """, (user_id, rule_id))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    rule = enrich_recurring_rule(cursor, user_id, dict(row))
    conn.close()
    return rule


def get_recurring_rules(user_id=DEFAULT_USER_ID, active_only=False):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT *
        FROM recurring_rules
        WHERE user_id = ?
    """
    params = [user_id]

    if active_only:
        query += " AND active = ?"
        params.append(1)

    query += " ORDER BY active DESC, name COLLATE NOCASE ASC"

    cursor.execute(query, params)
    rules = [enrich_recurring_rule(cursor, user_id, dict(row)) for row in cursor.fetchall()]

    conn.close()
    return rules


def get_categories_with_recurring(user_id=DEFAULT_USER_ID):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            COUNT(*) AS transaction_count,
            COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS expense_total,
            COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS income_total,
            MAX(t.date) AS latest_date,
            COALESCE(MAX(r.active), 0) AS is_recurring,
            MAX(r.id) AS recurring_rule_id,
            COALESCE(MAX(s.is_recurring_expense), 0) AS is_recurring_expense,
            COALESCE(MAX(s.is_income), 0) AS is_income
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        LEFT JOIN recurring_rules r
            ON r.user_id = t.user_id
            AND r.category = COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised')
            AND COALESCE(r.statement_match, '') = ''
        LEFT JOIN category_settings s
            ON s.user_id = t.user_id
            AND s.category = COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised')
        WHERE t.user_id = ?
        GROUP BY 1
        ORDER BY category COLLATE NOCASE ASC
    """, (user_id,))

    categories = []
    for row in cursor.fetchall():
        category = dict(row)
        category["is_recurring"] = bool(
            category["is_recurring"] or category.get("is_recurring_expense")
        )
        category["is_income"] = bool(category.get("is_income"))
        categories.append(category)

    conn.close()
    return categories


def set_category_recurring(user_id, category, active=True):
    category = (category or "").strip()
    if not category:
        return None

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id
        FROM recurring_rules
        WHERE user_id = ?
        AND category = ?
        AND COALESCE(statement_match, '') = ''
        LIMIT 1
    """, (user_id, category))

    row = cursor.fetchone()
    timestamp = now_iso()

    if row:
        cursor.execute("""
            UPDATE recurring_rules
            SET
                active = ?,
                updated_at = ?
            WHERE id = ?
            AND user_id = ?
        """, (1 if active else 0, timestamp, row["id"], user_id))
    else:
        cursor.execute("""
            INSERT INTO recurring_rules (
                id, user_id, name, type, period, category, statement_match,
                amount, start_date, active, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            uuid.uuid4().hex,
            user_id,
            category,
            "expense",
            "monthly",
            category,
            "",
            None,
            today_iso(),
            1 if active else 0,
            timestamp,
            timestamp,
        ))

    cursor.execute("""
        INSERT INTO category_settings (
            user_id, category, is_recurring_expense, is_income, updated_at
        )
        VALUES (?, ?, ?, 0, ?)
        ON CONFLICT(user_id, category) DO UPDATE SET
            is_recurring_expense = excluded.is_recurring_expense,
            updated_at = excluded.updated_at
    """, (user_id, category, 1 if active else 0, timestamp))

    conn.commit()
    conn.close()
    return get_category_summary(user_id, category)


def set_category_income(user_id, category, active=True):
    category = (category or "").strip()
    if not category:
        return None

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO category_settings (
            user_id, category, is_recurring_expense, is_income, updated_at
        )
        VALUES (?, ?, 0, ?, ?)
        ON CONFLICT(user_id, category) DO UPDATE SET
            is_income = excluded.is_income,
            updated_at = excluded.updated_at
    """, (user_id, category, 1 if active else 0, now_iso()))

    conn.commit()
    conn.close()
    return get_category_summary(user_id, category)


def get_category_summary(user_id, category):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            COUNT(*) AS transaction_count,
            COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS expense_total,
            COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS income_total,
            MAX(t.date) AS latest_date,
            COALESCE(MAX(r.active), 0) AS is_recurring,
            MAX(r.id) AS recurring_rule_id,
            COALESCE(MAX(s.is_recurring_expense), 0) AS is_recurring_expense,
            COALESCE(MAX(s.is_income), 0) AS is_income
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        LEFT JOIN recurring_rules r
            ON r.user_id = t.user_id
            AND r.category = COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised')
            AND COALESCE(r.statement_match, '') = ''
        LEFT JOIN category_settings s
            ON s.user_id = t.user_id
            AND s.category = COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised')
        WHERE t.user_id = ?
        AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') = ?
        GROUP BY 1
    """, (user_id, category))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    result = dict(row)
    result["is_recurring"] = bool(
        result["is_recurring"] or result.get("is_recurring_expense")
    )
    result["is_income"] = bool(result.get("is_income"))
    return result


def get_recurring_cashflow_history(user_id, period="monthly", count=12):
    if period not in {"weekly", "monthly", "yearly"}:
        period = "monthly"

    count = max(1, min(int(count or 12), 60))
    today = date.today()
    periods = build_projection_periods(today, period, count)

    conn = get_connection()
    cursor = conn.cursor()

    income_categories = get_income_categories(cursor, user_id)
    recurring_categories = get_recurring_expense_categories(cursor, user_id)

    points = []
    for item in periods:
        income = get_period_income(
            cursor,
            user_id,
            income_categories,
            item["start_date"],
            item["end_date"],
        )
        expenses = get_period_expenses_for_categories(
            cursor,
            user_id,
            recurring_categories,
            item["start_date"],
            item["end_date"],
        )
        points.append({
            **item,
            "income": income,
            "expenses": expenses,
            "net": income - expenses,
        })

    conn.close()

    return {
        "period": period,
        "count": count,
        "income_categories": income_categories,
        "recurring_expense_categories": recurring_categories,
        "points": points,
    }


def get_income_categories(cursor, user_id):
    cursor.execute("""
        SELECT category
        FROM category_settings
        WHERE user_id = ?
        AND is_income = 1
    """, (user_id,))
    return [row["category"] for row in cursor.fetchall()]


def get_recurring_expense_categories(cursor, user_id):
    cursor.execute("""
        SELECT category
        FROM category_settings
        WHERE user_id = ?
        AND is_recurring_expense = 1
        UNION
        SELECT category
        FROM recurring_rules
        WHERE user_id = ?
        AND active = 1
        AND category IS NOT NULL
        AND category != ''
        AND COALESCE(statement_match, '') = ''
    """, (user_id, user_id))
    return [row["category"] for row in cursor.fetchall()]


def get_category_transactions(user_id, category):
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
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            COALESCE(c.source, 'unset') AS category_source,
            COALESCE(c.status, 'unset') AS category_status
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') = ?
        ORDER BY t.date DESC
    """, (user_id, category))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def create_category_allocation(user_id, from_category, to_category, amount, allocation_date=None, note=None):
    conn = get_connection()
    cursor = conn.cursor()

    normalized_amount = abs(float(amount or 0))
    from_category = (from_category or "").strip()
    to_category = (to_category or "").strip()
    allocation_date = allocation_date or today_iso()

    if normalized_amount <= 0 or not from_category or not to_category:
        conn.close()
        return None

    allocation_id = uuid.uuid4().hex
    cursor.execute("""
        INSERT INTO transaction_allocations (
            id, user_id, transaction_id, from_category, to_category,
            amount, allocation_date, note, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        allocation_id,
        user_id,
        None,
        from_category,
        to_category,
        normalized_amount,
        allocation_date,
        note or "",
        now_iso(),
    ))

    conn.commit()
    conn.close()
    return get_category_allocation(user_id, allocation_id)


def delete_category_allocation(user_id, allocation_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM transaction_allocations
        WHERE user_id = ?
        AND id = ?
    """, (user_id, allocation_id))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_category_allocation(user_id, allocation_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            a.*,
            t.amount AS transaction_amount,
            t.date AS transaction_date,
            t.description,
            t.statement
        FROM transaction_allocations a
        LEFT JOIN transactions t
            ON t.user_id = a.user_id
            AND t.id = a.transaction_id
        WHERE a.user_id = ?
        AND a.id = ?
    """, (user_id, allocation_id))

    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_category_allocations(user_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            a.*,
            t.amount AS transaction_amount,
            t.date AS transaction_date,
            t.description,
            t.statement
        FROM transaction_allocations a
        LEFT JOIN transactions t
            ON t.user_id = a.user_id
            AND t.id = a.transaction_id
        WHERE a.user_id = ?
        ORDER BY COALESCE(a.allocation_date, t.date) DESC, a.created_at DESC
    """, (user_id,))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def apply_allocations_to_category_totals(user_id, rows, start_date=None, end_date=None):
    totals = {row["category"]: float(row["total"] or 0) for row in rows}

    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            a.from_category,
            a.to_category,
            a.amount
        FROM transaction_allocations a
        LEFT JOIN transactions t
            ON t.user_id = a.user_id
            AND t.id = a.transaction_id
        WHERE a.user_id = ?
    """
    params = [user_id]

    if start_date:
        query += " AND COALESCE(a.allocation_date, t.date) >= ?"
        params.append(start_date)

    if end_date:
        query += " AND COALESCE(a.allocation_date, t.date) <= ?"
        params.append(end_date)

    cursor.execute(query, params)
    allocations = [dict(row) for row in cursor.fetchall()]
    conn.close()

    for allocation in allocations:
        from_category = allocation["from_category"] or "Uncategorised"
        to_category = allocation["to_category"] or "Uncategorised"
        amount = float(allocation["amount"] or 0)
        totals[from_category] = totals.get(from_category, 0) - amount
        totals[to_category] = totals.get(to_category, 0) + amount

    adjusted = [
        {"category": category, "total": total}
        for category, total in totals.items()
        if total > 0
    ]
    adjusted.sort(key=lambda row: row["total"], reverse=True)
    total_amount = sum(row["total"] for row in adjusted)

    for row in adjusted:
        row["pct"] = round((row["total"] / total_amount) * 100, 1) if total_amount else 0

    return adjusted


def get_net_worth_projection(user_id, period="monthly", history_count=12, future_count=12):
    if period not in {"weekly", "monthly", "yearly"}:
        period = "monthly"

    history_count = max(1, min(int(history_count or 52), 261))
    future_count = max(1, min(int(future_count or 52), 261))
    today = date.today()

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT DISTINCT account_id
        FROM transactions
        WHERE user_id = ?
        AND account_id IS NOT NULL
        AND account_id != ''
    """, (user_id,))
    account_ids = [row["account_id"] for row in cursor.fetchall()]
    debt_by_week = get_debt_remaining_by_week(cursor, user_id, today, history_count)
    investment_by_week = get_investment_value_by_week(cursor, user_id, today, history_count)

    history_periods = build_weekly_projection_periods(today, history_count)
    history_points = []
    for item in history_periods:
        account_balance = get_net_worth_at_date(cursor, user_id, account_ids, item["end_date"])
        debt_remaining = debt_by_week.get(item["end_date"], 0)
        investment_value = investment_by_week.get(item["end_date"], 0)
        history_points.append({
            **item,
            "balance": account_balance + investment_value - debt_remaining,
            "account_balance": account_balance,
            "investment_value": investment_value,
            "debt_remaining": debt_remaining,
            "projected": False,
        })

    cursor.execute("""
        SELECT category
        FROM category_settings
        WHERE user_id = ?
        AND is_income = 1
    """, (user_id,))
    income_categories = [row["category"] for row in cursor.fetchall()]

    cursor.execute("""
        SELECT category
        FROM category_settings
        WHERE user_id = ?
        AND is_recurring_expense = 1
        UNION
        SELECT category
        FROM recurring_rules
        WHERE user_id = ?
        AND active = 1
        AND category IS NOT NULL
        AND category != ''
        AND COALESCE(statement_match, '') = ''
    """, (user_id, user_id))
    recurring_categories = [row["category"] for row in cursor.fetchall()]

    average_periods = build_projection_periods(
        today,
        period,
        get_average_period_count(period, history_count),
    )
    averages = get_projection_averages(
        cursor,
        user_id,
        average_periods,
        income_categories,
        recurring_categories,
    )
    weekly_income = averages["average_income"] / weeks_per_period(period)
    weekly_spending = averages["average_spending"] / weeks_per_period(period)

    current_account_balance = get_net_worth_at_date(cursor, user_id, account_ids, today.isoformat())
    current_investment_value = get_current_investment_value(cursor, user_id)
    current_debt_remaining = get_active_debt_remaining(cursor, user_id)
    current_balance = current_account_balance + current_investment_value - current_debt_remaining
    projection_points = []
    balance = current_balance
    cursor_date = today

    for _ in range(future_count):
        cursor_date = cursor_date + timedelta(days=7)
        balance += weekly_income - weekly_spending
        projection_points.append({
            "start_date": (cursor_date - timedelta(days=6)).isoformat(),
            "end_date": cursor_date.isoformat(),
            "label": format_projection_label(cursor_date, "weekly"),
            "balance": balance,
            "account_balance": None,
            "investment_value": None,
            "debt_remaining": None,
            "projected": True,
        })

    conn.close()

    return {
        "period": period,
        "point_period": "weekly",
        "history_count": history_count,
        "future_count": future_count,
        "current_balance": current_balance,
        "current_account_balance": current_account_balance,
        "current_investment_value": current_investment_value,
        "current_debt_remaining": current_debt_remaining,
        "average_income": averages["average_income"],
        "average_spending": averages["average_spending"],
        "average_net": averages["average_income"] - averages["average_spending"],
        "weekly_income": weekly_income,
        "weekly_spending": weekly_spending,
        "weekly_net": weekly_income - weekly_spending,
        "income_categories": income_categories,
        "recurring_expense_categories": recurring_categories,
        "points": history_points + projection_points,
    }



# ---------------------------
# DEBTS
# ---------------------------

def create_debt(user_id, name, initial_amount, category=None, start_date=None, active=True):
    conn = get_connection()
    cursor = conn.cursor()

    debt_id = uuid.uuid4().hex
    timestamp = now_iso()
    start_date = start_date or today_iso()
    category = (category or "").strip()

    cursor.execute("""
        INSERT INTO debts (
            id, user_id, name, initial_amount, category, start_date,
            active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        debt_id,
        user_id,
        name,
        initial_amount,
        category,
        start_date,
        1 if active else 0,
        timestamp,
        timestamp,
    ))

    conn.commit()
    conn.close()
    return get_debt(user_id, debt_id)


def update_debt(user_id, debt_id, name, initial_amount, category=None, start_date=None, active=True):
    conn = get_connection()
    cursor = conn.cursor()

    start_date = start_date or today_iso()
    category = (category or "").strip()

    cursor.execute("""
        UPDATE debts
        SET
            name = ?,
            initial_amount = ?,
            category = ?,
            start_date = ?,
            active = ?,
            updated_at = ?
        WHERE id = ?
        AND user_id = ?
    """, (
        name,
        initial_amount,
        category,
        start_date,
        1 if active else 0,
        now_iso(),
        debt_id,
        user_id,
    ))

    if cursor.rowcount == 0:
        conn.close()
        return None

    conn.commit()
    conn.close()
    return get_debt(user_id, debt_id)


def delete_debt(user_id, debt_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM debt_payments WHERE user_id = ? AND debt_id = ?", (user_id, debt_id))
    cursor.execute("DELETE FROM debts WHERE user_id = ? AND id = ?", (user_id, debt_id))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def create_debt_payment(user_id, debt_id, amount, payment_date=None, note=None):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM debts WHERE user_id = ? AND id = ?", (user_id, debt_id))
    if not cursor.fetchone():
        conn.close()
        return None

    payment_id = uuid.uuid4().hex
    payment_date = payment_date or today_iso()

    cursor.execute("""
        INSERT INTO debt_payments (
            id, user_id, debt_id, amount, payment_date, note, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        payment_id,
        user_id,
        debt_id,
        amount,
        payment_date,
        note or "",
        now_iso(),
    ))

    conn.commit()
    conn.close()
    return get_debt(user_id, debt_id)


def delete_debt_payment(user_id, debt_id, payment_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM debt_payments
        WHERE user_id = ?
        AND id = ?
        AND debt_id = ?
    """, (user_id, payment_id, debt_id))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_debt(user_id, debt_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM debts WHERE user_id = ? AND id = ?", (user_id, debt_id))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return None

    debt = enrich_debt(cursor, user_id, dict(row))
    conn.close()
    return debt


def get_debts(user_id, active_only=False):
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM debts WHERE user_id = ?"
    params = [user_id]

    if active_only:
        query += " AND active = ?"
        params.append(1)

    query += " ORDER BY active DESC, name COLLATE NOCASE ASC"

    cursor.execute(query, params)
    debts = [enrich_debt(cursor, user_id, dict(row)) for row in cursor.fetchall()]

    conn.close()
    return debts


def enrich_debt(cursor, user_id, debt):
    manual_payments = get_manual_debt_payments(cursor, user_id, debt["id"])
    linked_payments = get_linked_debt_payments(cursor, user_id, debt)
    manual_total = sum(float(payment["amount"] or 0) for payment in manual_payments)
    linked_total = sum(float(payment["amount"] or 0) for payment in linked_payments)
    initial_amount = float(debt.get("initial_amount") or 0)
    remaining = max(initial_amount - manual_total - linked_total, 0)
    paid = initial_amount - remaining

    return {
        **debt,
        "active": bool(debt.get("active")),
        "manual_payments": manual_payments,
        "linked_payments": linked_payments[:10],
        "manual_payment_total": manual_total,
        "linked_payment_total": linked_total,
        "paid_total": paid,
        "remaining_amount": remaining,
        "progress_pct": (paid / initial_amount * 100) if initial_amount else 0,
    }


def get_manual_debt_payments(cursor, user_id, debt_id):
    cursor.execute("""
        SELECT id, debt_id, amount, payment_date, note, created_at
        FROM debt_payments
        WHERE user_id = ?
        AND debt_id = ?
        ORDER BY payment_date DESC, created_at DESC
    """, (user_id, debt_id))

    return [dict(row) for row in cursor.fetchall()]


def get_linked_debt_payments(cursor, user_id, debt):
    category = (debt.get("category") or "").strip()
    if not category:
        return []

    cursor.execute("""
        SELECT
            t.id,
            ABS(t.amount) AS amount,
            t.date AS payment_date,
            t.statement,
            t.description,
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        AND t.amount < 0
        AND t.date >= ?
        AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') = ?
        ORDER BY t.date DESC
    """, (user_id, debt.get("start_date") or today_iso(), category))

    return [dict(row) for row in cursor.fetchall()]


def build_weekly_projection_periods(today, count):
    periods = []

    for index in range(count - 1, -1, -1):
        end_date = today - timedelta(days=index * 7)
        start_date = end_date - timedelta(days=6)
        periods.append({
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "label": format_projection_label(end_date, "weekly"),
        })

    return periods


def build_projection_periods(today, period, count):
    periods = []
    current_end = today

    for index in range(count - 1, -1, -1):
        end_date = shift_period(current_end, period, -index)
        start_date = shift_period(end_date, period, -1) + timedelta(days=1)
        periods.append({
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "label": format_projection_label(end_date, period),
        })

    return periods


def get_average_period_count(period, history_weeks):
    if period == "weekly":
        return max(1, history_weeks)
    if period == "yearly":
        return max(1, math.ceil(history_weeks / 52))
    return max(1, math.ceil(history_weeks / (52 / 12)))


def get_net_worth_at_date(cursor, user_id, account_ids, end_date):
    total = 0
    end_of_day = f"{end_date}T23:59:59"

    for account_id in account_ids:
        cursor.execute("""
            SELECT balance
            FROM transactions
            WHERE user_id = ?
            AND account_id = ?
            AND balance IS NOT NULL
            AND date <= ?
            ORDER BY date DESC
            LIMIT 1
        """, (user_id, account_id, end_of_day))

        row = cursor.fetchone()
        if row and row["balance"] is not None:
            total += float(row["balance"] or 0)

    return total


def get_active_debt_remaining(cursor, user_id):
    cursor.execute("""
        SELECT *
        FROM debts
        WHERE user_id = ?
        AND active = 1
    """, (user_id,))
    debts = [dict(row) for row in cursor.fetchall()]
    return sum(enrich_debt(cursor, user_id, debt)["remaining_amount"] for debt in debts)


def get_debt_remaining_by_week(cursor, user_id, today, history_count):
    periods = build_weekly_projection_periods(today, history_count)

    cursor.execute("""
        SELECT *
        FROM debts
        WHERE user_id = ?
        AND active = 1
    """, (user_id,))
    debts = [dict(row) for row in cursor.fetchall()]

    totals = {}
    for period in periods:
        total = 0
        for debt in debts:
            total += get_debt_remaining_at_date(cursor, user_id, debt, period["end_date"])
        totals[period["end_date"]] = total

    return totals


def get_debt_remaining_at_date(cursor, user_id, debt, end_date):
    initial_amount = float(debt.get("initial_amount") or 0)
    if not debt.get("start_date") or debt["start_date"] > end_date:
        return 0

    manual_total = get_manual_debt_payment_total_at_date(cursor, user_id, debt["id"], end_date)
    linked_total = get_linked_debt_payment_total_at_date(cursor, user_id, debt, end_date)
    return max(initial_amount - manual_total - linked_total, 0)


def get_manual_debt_payment_total_at_date(cursor, user_id, debt_id, end_date):
    cursor.execute("""
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM debt_payments
        WHERE user_id = ?
        AND debt_id = ?
        AND payment_date <= ?
    """, (user_id, debt_id, end_date))

    return float(cursor.fetchone()["total"] or 0)


def get_linked_debt_payment_total_at_date(cursor, user_id, debt, end_date):
    category = (debt.get("category") or "").strip()
    if not category:
        return 0

    cursor.execute("""
        SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        AND t.amount < 0
        AND t.date >= ?
        AND t.date <= ?
        AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') = ?
    """, (
        user_id,
        debt.get("start_date") or today_iso(),
        f"{end_date}T23:59:59",
        category,
    ))

    return float(cursor.fetchone()["total"] or 0)


def get_projection_averages(cursor, user_id, periods, income_categories, recurring_categories):
    income_values = []
    spending_values = []

    for item in periods:
        income_values.append(
            get_period_income(cursor, user_id, income_categories, item["start_date"], item["end_date"])
        )
        spending_values.append(
            get_period_non_recurring_spending(
                cursor,
                user_id,
                recurring_categories,
                item["start_date"],
                item["end_date"],
            )
        )

    count = len(periods) or 1
    return {
        "average_income": sum(income_values) / count,
        "average_spending": sum(spending_values) / count,
    }


def get_period_income(cursor, user_id, income_categories, start_date, end_date):
    if not income_categories:
        return 0

    placeholders = ",".join(["?"] * len(income_categories))
    end_of_day = f"{end_date}T23:59:59"
    cursor.execute(f"""
        SELECT COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        AND t.amount > 0
        AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') IN ({placeholders})
        AND t.date >= ?
        AND t.date <= ?
    """, [user_id] + income_categories + [start_date, end_of_day])

    return float(cursor.fetchone()["total"] or 0)


def get_period_non_recurring_spending(cursor, user_id, recurring_categories, start_date, end_date):
    end_of_day = f"{end_date}T23:59:59"
    params = [user_id, start_date, end_of_day]
    recurring_filter = ""

    if recurring_categories:
        placeholders = ",".join(["?"] * len(recurring_categories))
        recurring_filter = f"""
            AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') NOT IN ({placeholders})
        """
        params.extend(recurring_categories)

    cursor.execute(f"""
        SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        AND t.amount < 0
        AND t.date >= ?
        AND t.date <= ?
        {recurring_filter}
    """, params)

    return float(cursor.fetchone()["total"] or 0)


def get_period_expenses_for_categories(cursor, user_id, categories, start_date, end_date):
    if not categories:
        return 0

    placeholders = ",".join(["?"] * len(categories))
    end_of_day = f"{end_date}T23:59:59"
    cursor.execute(f"""
        SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        AND t.amount < 0
        AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') IN ({placeholders})
        AND t.date >= ?
        AND t.date <= ?
    """, [user_id] + categories + [start_date, end_of_day])

    return float(cursor.fetchone()["total"] or 0)


def shift_period(value, period, amount):
    if period == "weekly":
        return value + timedelta(days=7 * amount)
    if period == "yearly":
        return add_years(value, amount)
    return add_months(value, amount)


def increment_period(value, period):
    return shift_period(value, period, 1)


def weeks_per_period(period):
    if period == "weekly":
        return 1
    if period == "yearly":
        return 52
    return 52 / 12


def format_projection_label(value, period):
    if period == "weekly":
        return value.strftime("%d %b")
    if period == "yearly":
        return value.strftime("%Y")
    return value.strftime("%b %Y")


def enrich_recurring_rule(cursor, user_id, rule):
    period_start = get_current_period_start(
        rule.get("start_date"),
        rule.get("period"),
        date.today(),
    )
    matches = get_recurring_rule_matches(cursor, user_id, rule)
    current_matches = [
        txn for txn in matches
        if parse_date(txn.get("date")) and parse_date(txn.get("date")) >= parse_date(period_start)
    ]

    total_key = "amount"
    current_total = sum(abs(float(txn[total_key] or 0)) for txn in current_matches)
    average_amount = (
        sum(abs(float(txn[total_key] or 0)) for txn in matches) / len(matches)
        if matches else 0
    )
    last_match = matches[0] if matches else None

    return {
        **rule,
        "active": bool(rule.get("active")),
        "period_start": period_start,
        "current_period_total": current_total,
        "average_amount": average_amount,
        "transaction_count": len(matches),
        "last_amount": abs(float(last_match["amount"])) if last_match else None,
        "last_date": last_match["date"] if last_match else None,
        "recent_matches": matches[:5],
    }


def get_recurring_rule_matches(cursor, user_id, rule):
    filters = ["t.user_id = ?", "t.date >= ?"]
    params = [user_id, rule.get("start_date") or today_iso()]

    if rule.get("type") == "income":
        filters.append("t.amount > 0")
    else:
        filters.append("t.amount < 0")

    if rule.get("category"):
        filters.append("COALESCE(NULLIF(c.category, ''), t.category, '') = ?")
        params.append(rule["category"])

    if rule.get("statement_match"):
        filters.append("LOWER(COALESCE(t.statement, t.description, '')) LIKE ?")
        params.append(f"%{rule['statement_match'].lower()}%")

    where_clause = " AND ".join(filters)
    cursor.execute(f"""
        SELECT
            t.id,
            t.amount,
            t.date,
            t.description,
            t.statement,
            t.account_id,
            t.account_name,
            COALESCE(NULLIF(c.category, ''), t.category, '') AS category
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE {where_clause}
        ORDER BY t.date DESC
    """, params)

    return [dict(row) for row in cursor.fetchall()]


def normalize_recurring_type(rule_type):
    if rule_type == "income":
        return "income"
    return "expense"


def normalize_recurring_period(period):
    if period in {"weekly", "fortnightly", "monthly", "yearly"}:
        return period
    return "monthly"


def get_spent_for_categories(cursor, user_id, categories, start_date):
    if not categories:
        return 0

    placeholders = ",".join(["?"] * len(categories))
    cursor.execute(f"""
        SELECT COALESCE(SUM(ABS(t.amount)), 0) AS spent
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        AND t.amount < 0
        AND COALESCE(NULLIF(c.category, ''), t.category, '') IN ({placeholders})
        AND t.date >= ?
    """, [user_id] + categories + [start_date])

    return cursor.fetchone()["spent"] or 0


def get_current_period_start(start_date, period, today=None):
    today = today or date.today()
    anchor = parse_date(start_date) or today

    if anchor > today:
        return anchor.isoformat()

    if period == "weekly":
        elapsed_days = (today - anchor).days
        return (anchor + timedelta(days=(elapsed_days // 7) * 7)).isoformat()

    if period == "fortnightly":
        elapsed_days = (today - anchor).days
        return (anchor + timedelta(days=(elapsed_days // 14) * 14)).isoformat()

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


def get_known_categories(user_id=DEFAULT_USER_ID, limit=50):
    """Return distinct accepted category names, most frequently used first."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT category, COUNT(*) AS cnt
        FROM transaction_classifications
        WHERE user_id = ?
          AND status = 'accepted'
          AND category IS NOT NULL
          AND category != ''
        GROUP BY category
        ORDER BY cnt DESC
        LIMIT ?
    """, (user_id, limit))

    categories = [row["category"] for row in cursor.fetchall()]
    conn.close()
    return categories


