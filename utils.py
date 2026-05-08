from datetime import datetime, timedelta
import sqlite3
import json

DB_FILE = "transactions.db"


# =========================================================
# HELPERS
# =========================================================

def categorise_transaction(transaction):
    return ""  # placeholder for LLM classifier later


def clean_transactions(transactions):
    cleaned = []

    for txn in transactions:
        if txn.get("pending"):
            continue
        if txn.get("description", "").lower().find("transfer") != -1: #simple filter to block transfers between accounts
            continue
        cleaned.append({
            "_id": txn["_id"],
            "date": txn["date"],
            "amount": txn["amount"],
            "description": "",
            "category": categorise_transaction(txn),
            "statement": txn.get("description", ""),
            "_account": txn["_account"],
            "balance": txn.get("balance"),
        })

    return cleaned


def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


# =========================================================
# SPENDING TARGET PROGRESS
# =========================================================

def calculate_spending_target_progress(
    target_id,
):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            id,
            name,
            amount,
            period,
            categories
        FROM spending_targets
        WHERE id = ?
        """,
        (target_id,),
    )

    target = cursor.fetchone()

    if not target:
        conn.close()

        return {
            "spent": 0,
            "target": 0,
            "remaining": 0,
            "pct": 0,
        }

    target = dict(target)

    # SAFE CATEGORY PARSING
    raw_categories = target.get("categories", [])

    if isinstance(raw_categories, list):
        categories = raw_categories

    elif isinstance(raw_categories, str):
        try:
            categories = json.loads(raw_categories)
        except:
            categories = []

    else:
        categories = []

    now = datetime.now()

    if target["period"] == "weekly":
        start = now - timedelta(days=7)

    elif target["period"] == "yearly":
        start = now.replace(
            month=1,
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

    else:
        # monthly
        start = now.replace(
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

    # NO CATEGORIES = NO SPENDING
    if not categories:
        conn.close()

        return {
            "spent": 0,
            "target": target["amount"],
            "remaining": target["amount"],
            "pct": 0,
        }

    placeholders = ",".join(["?"] * len(categories))

    query = f"""
        SELECT COALESCE(SUM(ABS(amount)), 0)
        FROM transactions
        WHERE amount < 0
          AND category IN ({placeholders})
          AND date >= ?
    """

    params = categories + [
        start.strftime("%Y-%m-%d")
    ]

    cursor.execute(query, params)

    spent = cursor.fetchone()[0] or 0

    conn.close()

    target_amount = target["amount"] or 0

    return {
        "spent": round(spent, 2),
        "target": round(target_amount, 2),
        "remaining": round(
            max(target_amount - spent, 0),
            2,
        ),
        "pct": round(
            (spent / target_amount) * 100,
            1,
        ) if target_amount > 0 else 0,
    }


# =========================================================
# SAVING GOAL PROGRESS
# =========================================================

def calculate_saving_goal_progress(
    budget_id,
    goal_id,
):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, name, target, start_balance
        FROM saving_goals
        WHERE id = ?
        """,
        (goal_id,),
    )

    goal = cursor.fetchone()

    conn.close()

    if not goal:
        return {
            "saved": 0,
            "target": 0,
            "remaining": 0,
            "pct": 0,
        }

    goal = dict(goal)

    target = goal["target"]
    current = goal["start_balance"]

    return {
        "saved": round(current, 2),
        "target": round(target, 2),
        "remaining": round(
            max(target - current, 0),
            2,
        ),
        "pct": round(
            (current / target) * 100,
            1,
        ) if target > 0 else 0,
    }