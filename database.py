import sqlite3
import uuid
import json
from datetime import datetime

DB_FILE = "transactions.db"


# ─────────────────────────────
# CONNECTION
# ─────────────────────────────
def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


# ─────────────────────────────
# INIT DB
# ─────────────────────────────
def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Transactions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT,
        amount REAL,
        description TEXT,
        category TEXT,
        statement TEXT,
        account_id TEXT,
        balance REAL
    )
    """)

    # Budgets
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        start_date TEXT,
        created_at TEXT,
        transaction_count INTEGER,
        balances TEXT
    )
    """)

    # Budget ↔ Transactions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS budget_transactions (
        budget_id TEXT,
        transaction_id TEXT,
        UNIQUE(budget_id, transaction_id)
    )
    """)

    # Spending Targets
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS spending_targets (
        id TEXT PRIMARY KEY,
        budget_id TEXT,
        name TEXT,
        amount REAL,
        period TEXT
    )
    """)

    # Spending Target Categories
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS spending_target_categories (
        target_id TEXT,
        category TEXT,
        UNIQUE(target_id, category)
    )
    """)

    # Saving Goals
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS saving_goals (
        id TEXT PRIMARY KEY,
        budget_id TEXT,
        name TEXT,
        target REAL,
        by_date TEXT,
        start_balance REAL
    )
    """)

    conn.commit()
    conn.close()


# ─────────────────────────────
# BUDGETS
# ─────────────────────────────
def create_budget(start_date, transaction_ids):
    budget_id = uuid.uuid4().hex
    created_at = datetime.utcnow().isoformat()

    conn = get_connection()
    cursor = conn.cursor()

    balances = {}

    cursor.execute("""
        INSERT INTO budgets (
            id,
            start_date,
            created_at,
            transaction_count,
            balances
        )
        VALUES (?, ?, ?, ?, ?)
    """, (
        budget_id,
        start_date,
        created_at,
        len(transaction_ids),
        json.dumps(balances)
    ))

    for txn_id in transaction_ids:
        cursor.execute("""
            INSERT OR IGNORE INTO budget_transactions (
                budget_id,
                transaction_id
            )
            VALUES (?, ?)
        """, (budget_id, txn_id))

    conn.commit()
    conn.close()

    return {
        "id": budget_id,
        "start_date": start_date,
        "created_at": created_at,
        "transaction_count": len(transaction_ids),
        "balances": balances
    }


# ─────────────────────────────
# INGEST TRANSACTIONS
# ─────────────────────────────
def ingest_transactions(transactions):
    conn = get_connection()
    cursor = conn.cursor()

    for txn in transactions:
        cursor.execute("""
        INSERT OR IGNORE INTO transactions (
            id,
            date,
            amount,
            description,
            category,
            statement,
            account_id,
            balance
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            txn["_id"],
            txn["date"],
            txn["amount"],
            txn.get("description", ""),
            txn.get("category", ""),
            txn.get("statement", ""),
            txn["_account"],
            txn.get("balance")
        ))

    conn.commit()
    conn.close()


# ─────────────────────────────
# SPENDING TARGETS
# ─────────────────────────────
def create_spending_target(
    budget_id,
    name,
    amount,
    period,
    categories
):
    conn = get_connection()
    cursor = conn.cursor()

    target_id = uuid.uuid4().hex

    cursor.execute("""
        INSERT INTO spending_targets (
            id,
            budget_id,
            name,
            amount,
            period
        )
        VALUES (?, ?, ?, ?, ?)
    """, (
        target_id,
        budget_id,
        name,
        amount,
        period
    ))

    for category in categories:
        cursor.execute("""
            INSERT OR IGNORE INTO spending_target_categories (
                target_id,
                category
            )
            VALUES (?, ?)
        """, (
            target_id,
            category
        ))

    conn.commit()
    conn.close()

    return {
        "id": target_id,
        "budget_id": budget_id,
        "name": name,
        "amount": amount,
        "period": period,
        "categories": categories
    }


def get_spending_targets(budget_id):
    conn = get_connection()
    cursor = conn.cursor()

    if budget_id is None:
        cursor.execute("""
            SELECT *
            FROM spending_targets
        """)
    else:
        cursor.execute("""
            SELECT *
            FROM spending_targets
            WHERE budget_id = ?
        """, (budget_id,))

    targets = []

    for row in cursor.fetchall():
        target = dict(row)

        cursor.execute("""
            SELECT category
            FROM spending_target_categories
            WHERE target_id = ?
        """, (target["id"],))

        target["categories"] = [
            r["category"]
            for r in cursor.fetchall()
        ]

        targets.append(target)

    conn.close()

    return targets


def get_spending_target(target_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM spending_targets
        WHERE id = ?
    """, (target_id,))

    row = cursor.fetchone()

    if not row:
        conn.close()
        return None

    target = dict(row)

    cursor.execute("""
        SELECT category
        FROM spending_target_categories
        WHERE target_id = ?
    """, (target_id,))

    target["categories"] = [
        r["category"]
        for r in cursor.fetchall()
    ]

    conn.close()

    return target


# ─────────────────────────────
# SAVING GOALS
# ─────────────────────────────
def create_saving_goal(
    budget_id,
    name,
    target_amount,
    by_date,
    current_amount
):
    conn = get_connection()
    cursor = conn.cursor()

    goal_id = uuid.uuid4().hex

    cursor.execute("""
        INSERT INTO saving_goals (
            id,
            budget_id,
            name,
            target,
            by_date,
            start_balance
        )
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        goal_id,
        budget_id,
        name,
        target_amount,
        by_date,
        current_amount or 0
    ))

    conn.commit()
    conn.close()

    return {
        "id": goal_id,
        "budget_id": budget_id,
        "name": name,
        "target_amount": target_amount,
        "by_date": by_date,
        "current_amount": current_amount or 0
    }


# def get_saving_goals(budget_id):
#     conn = get_connection()
#     cursor = conn.cursor()

#     if budget_id is None:
#         cursor.execute("""
#             SELECT *
#             FROM saving_goals
#         """)
#     else:
#         cursor.execute("""
#             SELECT *
#             FROM saving_goals
#             WHERE budget_id = ?
#         """, (budget_id,))

#     goals = []

#     for row in cursor.fetchall():
#         goal = dict(row)

#         # Convert DB schema → frontend schema
#         goal["target_amount"] = goal.pop("target")
#         goal["current_amount"] = goal.pop("start_balance")

#         goals.append(goal)

#     conn.close()

#     return goals


def get_saving_goal(goal_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM saving_goals
        WHERE id = ?
    """, (goal_id,))

    row = cursor.fetchone()

    conn.close()

    if not row:
        return None

    goal = dict(row)

    goal["target_amount"] = goal.pop("target")
    goal["current_amount"] = goal.pop("start_balance")

    return goal