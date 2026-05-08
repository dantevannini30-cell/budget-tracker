from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import json
from datetime import datetime, timedelta, timezone

from database import (
    init_db,
    create_budget,
    ingest_transactions,
    create_spending_target,
    get_spending_targets,
    create_saving_goal,
    get_saving_goals,
)

from utils import (
    calculate_spending_target_progress,
    calculate_saving_goal_progress,
)

# ---------------------------
# INIT
# ---------------------------
init_db()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "transactions.db"


def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------
# MODELS
# ---------------------------
class BudgetCreate(BaseModel):
    start_date: str


class TransactionUpdate(BaseModel):
    category: str | None = None
    description: str | None = None


class SpendingTargetCreate(BaseModel):
    name: str
    amount: float
    period: str
    categories: list[str]


class SavingGoalCreate(BaseModel):
    name: str
    target: float
    by_date: str | None = None
    start_balance: float | None = None


# ---------------------------
# HEALTH CHECK
# ---------------------------
@app.get("/api/hello")
def hello():
    return {
        "message": "FastAPI running",
        "time": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------
# TRANSACTIONS
# ---------------------------
@app.get("/api/transactions")
def get_transactions():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, date, amount, description, category, statement, account_id
        FROM transactions
        WHERE LOWER(COALESCE(statement, description)) NOT LIKE '%transfer%'
        ORDER BY date DESC
        LIMIT 50
    """)

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


@app.put("/api/transactions/{transaction_id}")
def update_transaction(transaction_id: str, update: TransactionUpdate):
    conn = get_connection()
    cursor = conn.cursor()

    updates = []
    params = []

    if update.category is not None:
        updates.append("category = ?")
        params.append(update.category)

    if update.description is not None:
        updates.append("description = ?")
        params.append(update.description)

    if not updates:
        raise HTTPException(status_code=400, detail="No update provided")

    query = f"""
        UPDATE transactions
        SET {', '.join(updates)}
        WHERE id = ?
    """

    params.append(transaction_id)
    cursor.execute(query, params)

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not found")

    conn.commit()
    conn.close()

    return {"message": "updated"}


# ---------------------------
# SUMMARY
# ---------------------------
@app.get("/api/summary")
def summary():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0),
            COALESCE(SUM(amount), 0)
        FROM transactions
        WHERE LOWER(COALESCE(statement, description)) NOT LIKE '%transfer%'
    """)

    row = cursor.fetchone()
    conn.close()

    return {
        "total_in": row[0],
        "total_out": abs(row[1]),
        "net": row[2],
    }


# ---------------------------
# CATEGORY BREAKDOWN
# ---------------------------
@app.get("/api/summary/by-category")
def by_category():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COALESCE(NULLIF(category, ''), 'Uncategorised') as category,
            SUM(ABS(amount)) as total
        FROM transactions
        WHERE amount < 0
        GROUP BY category
        ORDER BY total DESC
    """)

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    total = sum(r["total"] for r in rows)

    for r in rows:
        r["pct"] = round((r["total"] / total) * 100, 1) if total else 0

    return rows


# ---------------------------
# BUDGETS
# ---------------------------
@app.get("/api/budgets")
def get_budgets():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, start_date, created_at, transaction_count, balances
        FROM budgets
        ORDER BY created_at DESC
    """)

    rows = []
    for r in cursor.fetchall():
        row = dict(r)
        row["balances"] = json.loads(row["balances"]) if row["balances"] else {}
        rows.append(row)

    conn.close()
    return rows


@app.post("/api/budgets")
def create_budget_endpoint(budget: BudgetCreate):
    datetime.strptime(budget.start_date, "%Y-%m-%d")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id
        FROM transactions
        WHERE date >= ?
          AND LOWER(COALESCE(statement, description)) NOT LIKE '%transfer%'
    """, (budget.start_date,))

    txn_ids = [r[0] for r in cursor.fetchall()]
    conn.close()

    return create_budget(budget.start_date, txn_ids)


@app.get("/api/budgets/{budget_id}/summary")
def budget_summary(budget_id: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM budgets WHERE id = ?", (budget_id,))
    budget = cursor.fetchone()

    if not budget:
        raise HTTPException(status_code=404, detail="Not found")

    budget = dict(budget)
    budget["balances"] = json.loads(budget["balances"]) if budget["balances"] else {}

    cursor.execute("""
        SELECT amount, date
        FROM transactions t
        JOIN budget_transactions bt ON bt.transaction_id = t.id
        WHERE bt.budget_id = ?
    """, (budget_id,))

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    total_in = sum(r["amount"] for r in rows if r["amount"] > 0)
    total_out = sum(abs(r["amount"]) for r in rows if r["amount"] < 0)

    return {
        **budget,
        "summary": {
            "total_in": total_in,
            "total_out": total_out,
            "net": total_in - total_out,
        },
    }


# ---------------------------
# SPENDING TARGETS
# ---------------------------
@app.post("/api/budgets/{budget_id}/spending-targets")
def add_target(budget_id: str, target: SpendingTargetCreate):
    return create_spending_target(
        budget_id,
        target.name,
        target.amount,
        target.period,
        target.categories,
    )


@app.get("/api/budgets/{budget_id}/spending-targets")
def list_targets(budget_id: str):
    return get_spending_targets(budget_id)


@app.get("/api/budgets/{budget_id}/spending-targets/{target_id}/progress")
def target_progress(budget_id: str, target_id: str):
    return calculate_spending_target_progress(budget_id, target_id)


# ---------------------------
# SAVING GOALS
# ---------------------------
@app.post("/api/budgets/{budget_id}/saving-goals")
def add_goal(budget_id: str, goal: SavingGoalCreate):
    conn = get_connection()
    cursor = conn.cursor()

    if goal.start_balance is None:
        cursor.execute("SELECT balances FROM budgets WHERE id = ?", (budget_id,))
        row = cursor.fetchone()
        balances = json.loads(row["balances"]) if row and row["balances"] else {}
        start_balance = sum(balances.values())
    else:
        start_balance = goal.start_balance

    conn.close()

    return create_saving_goal(
        budget_id,
        goal.name,
        goal.target,
        goal.by_date,
        start_balance,
    )


@app.get("/api/budgets/{budget_id}/saving-goals")
def list_goals(budget_id: str):
    return get_saving_goals(budget_id)


@app.get("/api/budgets/{budget_id}/saving-goals/{goal_id}/progress")
def goal_progress(budget_id: str, goal_id: str):
    return calculate_saving_goal_progress(budget_id, goal_id)



@app.get("/api/budgets/{budget_id}/transactions")
def get_budget_transactions(budget_id: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT t.id, t.date, t.amount, t.description, t.category, t.statement, t.account_id
        FROM transactions t
        JOIN budget_transactions bt ON bt.transaction_id = t.id
        WHERE bt.budget_id = ?
          AND LOWER(COALESCE(t.statement, t.description)) NOT LIKE '%transfer%'
        ORDER BY t.date DESC
    """, (budget_id,))

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return rows