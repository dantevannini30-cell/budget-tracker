import sqlite3
import uuid
import json
from datetime import datetime

DB_FILE = "transactions.db"


# ---------------------------
# CONNECTION
# ---------------------------

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------
# INIT
# ---------------------------

import sqlite3

DB_FILE = "transactions.db"


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
            current_amount REAL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS spending_targets (
            id TEXT PRIMARY KEY,
            name TEXT,
            amount REAL,
            period TEXT
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
        balance REAL
    )
""")

    conn.commit()
    conn.close()


# ---------------------------
# TRANSACTIONS
# ---------------------------

import uuid

def ingest_transactions(transactions):
    conn = get_connection()
    cursor = conn.cursor()

    for txn in transactions:
        txn_id = txn.get("_id")

        # ❌ reject invalid upstream IDs
        if not txn_id:
            txn_id = uuid.uuid4().hex

        cursor.execute("""
        INSERT OR IGNORE INTO transactions (
            id, date, amount, description,
            category, statement, account_id, balance
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            txn_id,
            txn.get("date"),
            txn.get("amount"),
            txn.get("description", ""),
            txn.get("category", ""),
            txn.get("statement", ""),
            txn.get("_account", ""),
            txn.get("balance", 0),
        ))

    conn.commit()
    conn.close()
# ---------------------------
# SPENDING TARGETS
# ---------------------------

def create_spending_target(name, amount, period, categories):
    conn = get_connection()
    cursor = conn.cursor()

    target_id = uuid.uuid4().hex

    cursor.execute("""
        INSERT INTO spending_targets (id, name, amount, period)
        VALUES (?, ?, ?, ?)
    """, (target_id, name, amount, period))

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

def create_saving_goal(name, target_amount, current_amount=0):
    conn = get_connection()
    cursor = conn.cursor()

    goal_id = uuid.uuid4().hex

    cursor.execute("""
        INSERT INTO saving_goals (id, name, target_amount, current_amount)
        VALUES (?, ?, ?, ?)
    """, (goal_id, name, target_amount, current_amount))

    conn.commit()
    conn.close()

    return {
        "id": goal_id,
        "name": name,
        "target_amount": target_amount,
        "current_amount": current_amount,
    }


def get_saving_goals():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM saving_goals")
    rows = cursor.fetchall()

    conn.close()

    return [dict(r) for r in rows]




def get_spending_targets_with_progress():
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Get all targets
    cursor.execute("SELECT * FROM spending_targets")
    targets = cursor.fetchall()

    result = []

    for t in targets:
        target = dict(t)

        # 2. Get categories for this target
        cursor.execute("""
            SELECT category
            FROM spending_target_categories
            WHERE target_id = ?
        """, (target["id"],))

        categories = [r["category"] for r in cursor.fetchall()]
        target["categories"] = categories

        # 3. Get actual spending for those categories
        if categories:
            placeholders = ",".join(["?"] * len(categories))

            cursor.execute(f"""
                SELECT COALESCE(SUM(amount), 0) as spent
                FROM transactions
                WHERE category IN ({placeholders})
            """, categories)

            spent = cursor.fetchone()["spent"]
        else:
            spent = 0

        # 4. Compute metrics
        target_amount = target["amount"]

        target["current_spent"] = spent
        target["remaining"] = target_amount - spent
        target["progress_pct"] = (
            (spent / target_amount) * 100 if target_amount else 0
        )
        target["is_over"] = spent > target_amount

        result.append(target)

    conn.close()
    return result