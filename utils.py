import sqlite3
from classifier import classify_transaction
from database import get_current_period_start
DB_FILE = "transactions.db"


def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------
# CLEANING
# ---------------------------
import uuid
def clean_transactions(transactions):
    cleaned = []

    for txn in transactions:
        if txn.get("pending"):
            continue
        if "transfer" in txn.get("description", "").lower():
            continue
        txn_id = txn.get("id") or uuid.uuid4().hex
        cleaned.append({
            "id": txn_id,
            "date": txn["date"],
            "amount": txn["amount"],
            "description": "",
            "category": classify_transaction(txn),
            "statement": txn.get("description", ""),
            "_account": txn.get("_account", ""),
            "account_name": txn.get("account_name", ""),
            "balance": txn.get("balance"),
        })

    return cleaned


# ---------------------------
# SPENDING TARGET PROGRESS
# ---------------------------

def calculate_spending_target_progress(target_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT name, amount, period, start_date
        FROM spending_targets
        WHERE id = ?
    """, (target_id,))

    target = cursor.fetchone()

    if not target:
        return {"spent": 0, "target": 0, "remaining": 0, "pct": 0}

    cursor.execute("""
        SELECT category
        FROM spending_target_categories
        WHERE target_id = ?
    """, (target_id,))

    categories = [r["category"] for r in cursor.fetchall()]

    if not categories:
        return {"spent": 0, "target": target["amount"], "remaining": target["amount"], "pct": 0}

    start = get_current_period_start(target["start_date"], target["period"])

    placeholders = ",".join(["?"] * len(categories))

    cursor.execute(f"""
        SELECT COALESCE(SUM(ABS(amount)), 0)
        FROM transactions
        WHERE amount < 0
        AND category IN ({placeholders})
        AND date >= ?
    """, categories + [start])

    spent = cursor.fetchone()[0] or 0

    target_amount = target["amount"]

    conn.close()

    return {
        "spent": spent,
        "target": target_amount,
        "remaining": max(target_amount - spent, 0),
        "pct": round((spent / target_amount) * 100, 1) if target_amount else 0,
    }


# ---------------------------
# SAVING GOAL PROGRESS
# ---------------------------
def calculate_saving_goal_progress(goal_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT target_amount, current_amount
        FROM saving_goals
        WHERE id = ?
    """, (goal_id,))

    goal = cursor.fetchone()
    conn.close()

    if not goal:
        return {"saved": 0, "target": 0, "remaining": 0, "pct": 0}

    target = goal["target_amount"]
    current = goal["current_amount"]

    return {
        "saved": current,
        "target": target,
        "remaining": max(target - current, 0),
        "pct": round((current / target) * 100, 1) if target else 0,
    }
