from datetime import datetime
from database import get_connection


def categorise_transaction(transaction):
    return ""  # placeholder for LLM classifier later


def clean_transactions(transactions):
    cleaned = []

    for txn in transactions:
        if txn.get("pending"):
            continue

        cleaned.append({
            "_id": txn["_id"],
            "date": txn["date"],
            "amount": txn["amount"],
            "description": "",
            "category": categorise_transaction(txn),
            "statement": txn.get("description", ""),
            "_account": txn["_account"],
            "balance": txn.get("balance")
        })

    return cleaned


# ─────────────────────────────────────────────
# FIX: SPENDING TARGET PROGRESS
# ─────────────────────────────────────────────
def calculate_spending_target_progress(budget_id: str, target_id: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT amount, period
        FROM spending_targets
        WHERE id = ? AND budget_id = ?
    """, (target_id, budget_id))

    target = cursor.fetchone()
    if not target:
        conn.close()
        raise ValueError("Target not found")

    target_amount = target[0]

    cursor.execute("""
        SELECT t.amount
        FROM transactions t
        JOIN budget_transactions bt ON bt.transaction_id = t.id
        WHERE bt.budget_id = ?
          AND t.amount < 0
    """, (budget_id,))

    spent = sum(abs(r[0]) for r in cursor.fetchall())

    conn.close()

    return {
        "target": target_amount,
        "spent": round(spent, 2),
        "remaining": round(target_amount - spent, 2),
        "pct": round((spent / target_amount) * 100, 1) if target_amount else 0
    }


# ─────────────────────────────────────────────
# FIX: SAVING GOAL PROGRESS
# ─────────────────────────────────────────────
def calculate_saving_goal_progress(budget_id: str, goal_id: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT target, start_balance, by_date
        FROM saving_goals
        WHERE id = ? AND budget_id = ?
    """, (goal_id, budget_id))

    goal = cursor.fetchone()
    if not goal:
        conn.close()
        raise ValueError("Goal not found")

    target, start_balance, by_date = goal

    cursor.execute("""
        SELECT SUM(amount)
        FROM transactions t
        JOIN budget_transactions bt ON bt.transaction_id = t.id
        WHERE bt.budget_id = ?
    """, (budget_id,))

    net = cursor.fetchone()[0] or 0
    current = (start_balance or 0) + net

    conn.close()

    return {
        "target": target,
        "saved": round(current, 2),
        "remaining": round(target - current, 2),
        "pct": round((current / target) * 100, 1) if target else 0,
        "by_date": by_date
    }