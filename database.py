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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recurring_rules (
            id TEXT PRIMARY KEY,
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
            category TEXT PRIMARY KEY,
            is_recurring_expense INTEGER DEFAULT 0,
            is_income INTEGER DEFAULT 0,
            updated_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS debts (
            id TEXT PRIMARY KEY,
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
            transaction_id TEXT,
            from_category TEXT,
            to_category TEXT,
            amount REAL,
            note TEXT,
            created_at TEXT
        )
    """)

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
    ensure_column(cursor, "debts", "category", "TEXT")
    ensure_column(cursor, "debts", "start_date", "TEXT")
    ensure_column(cursor, "debts", "active", "INTEGER DEFAULT 1")
    ensure_column(cursor, "debts", "created_at", "TEXT")
    ensure_column(cursor, "debts", "updated_at", "TEXT")
    ensure_column(cursor, "transaction_allocations", "allocation_date", "TEXT")

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
        "human",
        "accepted",
        updated_by,
    )

    conn.commit()
    conn.close()
    return True


def accept_all_suggested_transaction_categories(updated_by="user"):
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
        AND status = 'suggested'
        AND category IS NOT NULL
        AND category != ''
    """, (now_iso(), updated_by))

    accepted_count = cursor.rowcount
    conn.commit()
    conn.close()
    return accepted_count


def write_classifier_batch(results):
    if not results:
        return

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


def classify_unset_transactions(limit=None, batch_size=DEFAULT_CLASSIFICATION_BATCH_SIZE):
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
            ON c.transaction_id = t.id
        WHERE COALESCE(c.status, 'unset') = 'unset'
        OR c.source = 'classifier'
        ORDER BY t.date DESC
    """
    params = []

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
        category = classify_transaction(row)
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
            write_classifier_batch(batch)
            print(f"[classifier] wrote batch size={len(batch)}")
            batch = []

    if batch:
        write_classifier_batch(batch)
        print(f"[classifier] wrote batch size={len(batch)}")

    if not results:
        print("[classifier] done classified=0")
        return []

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


def get_account_balance_history(account_id, period="weekly", count=8, today=None):
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
            WHERE account_id = ?
            AND balance IS NOT NULL
            AND date <= ?
            ORDER BY date DESC
            LIMIT 1
        """, (account_id, end_of_day))

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


def create_recurring_rule(
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
            id, name, type, period, category, statement_match,
            amount, start_date, active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        rule_id,
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

    return get_recurring_rule(rule_id)


def update_recurring_rule(
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
    ))

    if cursor.rowcount == 0:
        conn.close()
        return None

    conn.commit()
    conn.close()
    return get_recurring_rule(rule_id)


def delete_recurring_rule(rule_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM recurring_rules
        WHERE id = ?
    """, (rule_id,))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_recurring_rule(rule_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM recurring_rules
        WHERE id = ?
    """, (rule_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    rule = enrich_recurring_rule(cursor, dict(row))
    conn.close()
    return rule


def get_recurring_rules(active_only=False):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT *
        FROM recurring_rules
    """
    params = []

    if active_only:
        query += " WHERE active = ?"
        params.append(1)

    query += " ORDER BY active DESC, name COLLATE NOCASE ASC"

    cursor.execute(query, params)
    rules = [enrich_recurring_rule(cursor, dict(row)) for row in cursor.fetchall()]

    conn.close()
    return rules


def get_categories_with_recurring():
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
            ON c.transaction_id = t.id
        LEFT JOIN recurring_rules r
            ON r.category = COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised')
            AND COALESCE(r.statement_match, '') = ''
        LEFT JOIN category_settings s
            ON s.category = COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised')
        GROUP BY 1
        ORDER BY category COLLATE NOCASE ASC
    """)

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


def set_category_recurring(category, active=True):
    category = (category or "").strip()
    if not category:
        return None

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id
        FROM recurring_rules
        WHERE category = ?
        AND COALESCE(statement_match, '') = ''
        LIMIT 1
    """, (category,))

    row = cursor.fetchone()
    timestamp = now_iso()

    if row:
        cursor.execute("""
            UPDATE recurring_rules
            SET
                active = ?,
                updated_at = ?
            WHERE id = ?
        """, (1 if active else 0, timestamp, row["id"]))
    else:
        cursor.execute("""
            INSERT INTO recurring_rules (
                id, name, type, period, category, statement_match,
                amount, start_date, active, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            uuid.uuid4().hex,
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
            category, is_recurring_expense, is_income, updated_at
        )
        VALUES (?, ?, 0, ?)
        ON CONFLICT(category) DO UPDATE SET
            is_recurring_expense = excluded.is_recurring_expense,
            updated_at = excluded.updated_at
    """, (category, 1 if active else 0, timestamp))

    conn.commit()
    conn.close()
    return get_category_summary(category)


def set_category_income(category, active=True):
    category = (category or "").strip()
    if not category:
        return None

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO category_settings (
            category, is_recurring_expense, is_income, updated_at
        )
        VALUES (?, 0, ?, ?)
        ON CONFLICT(category) DO UPDATE SET
            is_income = excluded.is_income,
            updated_at = excluded.updated_at
    """, (category, 1 if active else 0, now_iso()))

    conn.commit()
    conn.close()
    return get_category_summary(category)


def get_category_summary(category):
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
            ON c.transaction_id = t.id
        LEFT JOIN recurring_rules r
            ON r.category = COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised')
            AND COALESCE(r.statement_match, '') = ''
        LEFT JOIN category_settings s
            ON s.category = COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised')
        WHERE COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') = ?
        GROUP BY 1
    """, (category,))

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


def get_recurring_cashflow_history(period="monthly", count=12):
    if period not in {"weekly", "monthly", "yearly"}:
        period = "monthly"

    count = max(1, min(int(count or 12), 60))
    today = date.today()
    periods = build_projection_periods(today, period, count)

    conn = get_connection()
    cursor = conn.cursor()

    income_categories = get_income_categories(cursor)
    recurring_categories = get_recurring_expense_categories(cursor)

    points = []
    for item in periods:
        income = get_period_income(
            cursor,
            income_categories,
            item["start_date"],
            item["end_date"],
        )
        expenses = get_period_expenses_for_categories(
            cursor,
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


def get_income_categories(cursor):
    cursor.execute("""
        SELECT category
        FROM category_settings
        WHERE is_income = 1
    """)
    return [row["category"] for row in cursor.fetchall()]


def get_recurring_expense_categories(cursor):
    cursor.execute("""
        SELECT category
        FROM category_settings
        WHERE is_recurring_expense = 1
        UNION
        SELECT category
        FROM recurring_rules
        WHERE active = 1
        AND category IS NOT NULL
        AND category != ''
        AND COALESCE(statement_match, '') = ''
    """)
    return [row["category"] for row in cursor.fetchall()]


def get_category_transactions(category):
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
            ON c.transaction_id = t.id
        WHERE COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') = ?
        ORDER BY t.date DESC
    """, (category,))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def create_category_allocation(from_category, to_category, amount, allocation_date=None, note=None):
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
            id, transaction_id, from_category, to_category,
            amount, allocation_date, note, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        allocation_id,
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
    return get_category_allocation(allocation_id)


def delete_category_allocation(allocation_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM transaction_allocations
        WHERE id = ?
    """, (allocation_id,))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_category_allocation(allocation_id):
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
            ON t.id = a.transaction_id
        WHERE a.id = ?
    """, (allocation_id,))

    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_category_allocations():
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
            ON t.id = a.transaction_id
        ORDER BY COALESCE(a.allocation_date, t.date) DESC, a.created_at DESC
    """)

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def apply_allocations_to_category_totals(rows, start_date=None, end_date=None):
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
            ON t.id = a.transaction_id
        WHERE 1 = 1
    """
    params = []

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


def get_net_worth_projection(period="monthly", history_count=12, future_count=12):
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
        WHERE account_id IS NOT NULL
        AND account_id != ''
    """)
    account_ids = [row["account_id"] for row in cursor.fetchall()]
    debt_by_week = get_debt_remaining_by_week(cursor, today, history_count)

    history_periods = build_weekly_projection_periods(today, history_count)
    history_points = []
    for item in history_periods:
        account_balance = get_net_worth_at_date(cursor, account_ids, item["end_date"])
        debt_remaining = debt_by_week.get(item["end_date"], 0)
        history_points.append({
            **item,
            "balance": account_balance - debt_remaining,
            "account_balance": account_balance,
            "debt_remaining": debt_remaining,
            "projected": False,
        })

    cursor.execute("""
        SELECT category
        FROM category_settings
        WHERE is_income = 1
    """)
    income_categories = [row["category"] for row in cursor.fetchall()]

    cursor.execute("""
        SELECT category
        FROM category_settings
        WHERE is_recurring_expense = 1
        UNION
        SELECT category
        FROM recurring_rules
        WHERE active = 1
        AND category IS NOT NULL
        AND category != ''
        AND COALESCE(statement_match, '') = ''
    """)
    recurring_categories = [row["category"] for row in cursor.fetchall()]

    average_periods = build_projection_periods(
        today,
        period,
        get_average_period_count(period, history_count),
    )
    averages = get_projection_averages(
        cursor,
        average_periods,
        income_categories,
        recurring_categories,
    )
    weekly_income = averages["average_income"] / weeks_per_period(period)
    weekly_spending = averages["average_spending"] / weeks_per_period(period)

    current_account_balance = get_net_worth_at_date(cursor, account_ids, today.isoformat())
    current_debt_remaining = get_active_debt_remaining(cursor)
    current_balance = current_account_balance - current_debt_remaining
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

def create_debt(name, initial_amount, category=None, start_date=None, active=True):
    conn = get_connection()
    cursor = conn.cursor()

    debt_id = uuid.uuid4().hex
    timestamp = now_iso()
    start_date = start_date or today_iso()
    category = (category or "").strip()

    cursor.execute("""
        INSERT INTO debts (
            id, name, initial_amount, category, start_date,
            active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        debt_id,
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
    return get_debt(debt_id)


def update_debt(debt_id, name, initial_amount, category=None, start_date=None, active=True):
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
    """, (
        name,
        initial_amount,
        category,
        start_date,
        1 if active else 0,
        now_iso(),
        debt_id,
    ))

    if cursor.rowcount == 0:
        conn.close()
        return None

    conn.commit()
    conn.close()
    return get_debt(debt_id)


def delete_debt(debt_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM debt_payments WHERE debt_id = ?", (debt_id,))
    cursor.execute("DELETE FROM debts WHERE id = ?", (debt_id,))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def create_debt_payment(debt_id, amount, payment_date=None, note=None):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM debts WHERE id = ?", (debt_id,))
    if not cursor.fetchone():
        conn.close()
        return None

    payment_id = uuid.uuid4().hex
    payment_date = payment_date or today_iso()

    cursor.execute("""
        INSERT INTO debt_payments (
            id, debt_id, amount, payment_date, note, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        payment_id,
        debt_id,
        amount,
        payment_date,
        note or "",
        now_iso(),
    ))

    conn.commit()
    conn.close()
    return get_debt(debt_id)


def delete_debt_payment(debt_id, payment_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM debt_payments
        WHERE id = ?
        AND debt_id = ?
    """, (payment_id, debt_id))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_debt(debt_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM debts WHERE id = ?", (debt_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return None

    debt = enrich_debt(cursor, dict(row))
    conn.close()
    return debt


def get_debts(active_only=False):
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM debts"
    params = []

    if active_only:
        query += " WHERE active = ?"
        params.append(1)

    query += " ORDER BY active DESC, name COLLATE NOCASE ASC"

    cursor.execute(query, params)
    debts = [enrich_debt(cursor, dict(row)) for row in cursor.fetchall()]

    conn.close()
    return debts


def enrich_debt(cursor, debt):
    manual_payments = get_manual_debt_payments(cursor, debt["id"])
    linked_payments = get_linked_debt_payments(cursor, debt)
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


def get_manual_debt_payments(cursor, debt_id):
    cursor.execute("""
        SELECT id, debt_id, amount, payment_date, note, created_at
        FROM debt_payments
        WHERE debt_id = ?
        ORDER BY payment_date DESC, created_at DESC
    """, (debt_id,))

    return [dict(row) for row in cursor.fetchall()]


def get_linked_debt_payments(cursor, debt):
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
            ON c.transaction_id = t.id
        WHERE t.amount < 0
        AND t.date >= ?
        AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') = ?
        ORDER BY t.date DESC
    """, (debt.get("start_date") or today_iso(), category))

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


def get_net_worth_at_date(cursor, account_ids, end_date):
    total = 0
    end_of_day = f"{end_date}T23:59:59"

    for account_id in account_ids:
        cursor.execute("""
            SELECT balance
            FROM transactions
            WHERE account_id = ?
            AND balance IS NOT NULL
            AND date <= ?
            ORDER BY date DESC
            LIMIT 1
        """, (account_id, end_of_day))

        row = cursor.fetchone()
        if row and row["balance"] is not None:
            total += float(row["balance"] or 0)

    return total


def get_active_debt_remaining(cursor):
    cursor.execute("""
        SELECT *
        FROM debts
        WHERE active = 1
    """)
    debts = [dict(row) for row in cursor.fetchall()]
    return sum(enrich_debt(cursor, debt)["remaining_amount"] for debt in debts)


def get_debt_remaining_by_week(cursor, today, history_count):
    periods = build_weekly_projection_periods(today, history_count)

    cursor.execute("""
        SELECT *
        FROM debts
        WHERE active = 1
    """)
    debts = [dict(row) for row in cursor.fetchall()]

    totals = {}
    for period in periods:
        total = 0
        for debt in debts:
            total += get_debt_remaining_at_date(cursor, debt, period["end_date"])
        totals[period["end_date"]] = total

    return totals


def get_debt_remaining_at_date(cursor, debt, end_date):
    initial_amount = float(debt.get("initial_amount") or 0)
    if not debt.get("start_date") or debt["start_date"] > end_date:
        return 0

    manual_total = get_manual_debt_payment_total_at_date(cursor, debt["id"], end_date)
    linked_total = get_linked_debt_payment_total_at_date(cursor, debt, end_date)
    return max(initial_amount - manual_total - linked_total, 0)


def get_manual_debt_payment_total_at_date(cursor, debt_id, end_date):
    cursor.execute("""
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM debt_payments
        WHERE debt_id = ?
        AND payment_date <= ?
    """, (debt_id, end_date))

    return float(cursor.fetchone()["total"] or 0)


def get_linked_debt_payment_total_at_date(cursor, debt, end_date):
    category = (debt.get("category") or "").strip()
    if not category:
        return 0

    cursor.execute("""
        SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        WHERE t.amount < 0
        AND t.date >= ?
        AND t.date <= ?
        AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') = ?
    """, (
        debt.get("start_date") or today_iso(),
        f"{end_date}T23:59:59",
        category,
    ))

    return float(cursor.fetchone()["total"] or 0)


def get_projection_averages(cursor, periods, income_categories, recurring_categories):
    income_values = []
    spending_values = []

    for item in periods:
        income_values.append(
            get_period_income(cursor, income_categories, item["start_date"], item["end_date"])
        )
        spending_values.append(
            get_period_non_recurring_spending(
                cursor,
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


def get_period_income(cursor, income_categories, start_date, end_date):
    if not income_categories:
        return 0

    placeholders = ",".join(["?"] * len(income_categories))
    end_of_day = f"{end_date}T23:59:59"
    cursor.execute(f"""
        SELECT COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        WHERE t.amount > 0
        AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') IN ({placeholders})
        AND t.date >= ?
        AND t.date <= ?
    """, income_categories + [start_date, end_of_day])

    return float(cursor.fetchone()["total"] or 0)


def get_period_non_recurring_spending(cursor, recurring_categories, start_date, end_date):
    end_of_day = f"{end_date}T23:59:59"
    params = [start_date, end_of_day]
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
            ON c.transaction_id = t.id
        WHERE t.amount < 0
        AND t.date >= ?
        AND t.date <= ?
        {recurring_filter}
    """, params)

    return float(cursor.fetchone()["total"] or 0)


def get_period_expenses_for_categories(cursor, categories, start_date, end_date):
    if not categories:
        return 0

    placeholders = ",".join(["?"] * len(categories))
    end_of_day = f"{end_date}T23:59:59"
    cursor.execute(f"""
        SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        WHERE t.amount < 0
        AND COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') IN ({placeholders})
        AND t.date >= ?
        AND t.date <= ?
    """, categories + [start_date, end_of_day])

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


def enrich_recurring_rule(cursor, rule):
    period_start = get_current_period_start(
        rule.get("start_date"),
        rule.get("period"),
        date.today(),
    )
    matches = get_recurring_rule_matches(cursor, rule)
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


def get_recurring_rule_matches(cursor, rule):
    filters = ["t.date >= ?"]
    params = [rule.get("start_date") or today_iso()]

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
            ON c.transaction_id = t.id
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
