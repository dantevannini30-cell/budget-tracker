import sqlite3
import uuid
from datetime import date, datetime, timedelta

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
            updated_at TEXT,
            updated_by TEXT
        )
    """)

    ensure_column(cursor, "saving_goals", "start_date", "TEXT")
    ensure_column(cursor, "saving_goals", "account_id", "TEXT")
    ensure_column(cursor, "spending_targets", "start_date", "TEXT")
    ensure_column(cursor, "transactions", "account_name", "TEXT")

    backfill_transaction_classifications(cursor)
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
            transaction_id, category, source, updated_at, updated_by
        )
        SELECT
            id,
            COALESCE(category, ''),
            CASE
                WHEN category IS NULL OR category = '' THEN 'unset'
                ELSE 'legacy'
            END,
            ?,
            NULL
        FROM transactions
    """, (now_iso(),))


def upsert_transaction_classification(
    cursor,
    transaction_id,
    category="",
    source="unset",
    updated_by=None,
):
    cursor.execute("""
        INSERT INTO transaction_classifications (
            transaction_id, category, source, updated_at, updated_by
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(transaction_id) DO UPDATE SET
            category = excluded.category,
            source = excluded.source,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
    """, (
        transaction_id,
        category or "",
        source,
        now_iso(),
        updated_by,
    ))


def ingest_transactions(transactions):
    conn = get_connection()
    cursor = conn.cursor()
    inserted_ids = []

    for txn in transactions:
        txn_id = txn.get("id")

        if not txn_id:
            txn_id = uuid.uuid4().hex

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
            t.*,
            COALESCE(NULLIF(c.category, ''), t.category, '') AS category,
            COALESCE(c.source, 'unset') AS category_source,
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

    cursor.execute("SELECT id FROM transactions WHERE id = ?", (transaction_id,))
    if not cursor.fetchone():
        conn.close()
        return False

    upsert_transaction_classification(
        cursor,
        transaction_id,
        category,
        source,
        updated_by,
    )

    conn.commit()
    conn.close()
    return True


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
