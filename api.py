from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import json
from datetime import datetime, timedelta, timezone

from database import (
    init_db,
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
    target_amount: float
    current_amount: float | None = None


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
def summary(start_date: str | None = None, end_date: str | None = None):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0),
            COALESCE(SUM(amount), 0)
        FROM transactions
        WHERE LOWER(COALESCE(statement, description)) NOT LIKE '%transfer%'
    """
    
    params = []
    
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND date < ?"
        # Add 1 day to end_date to include the entire day
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        params.append(end_dt.strftime("%Y-%m-%d"))
    
    cursor.execute(query, params)
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
def by_category(start_date: str | None = None, end_date: str | None = None):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            COALESCE(NULLIF(category, ''), 'Uncategorised') as category,
            SUM(ABS(amount)) as total
        FROM transactions
        WHERE amount < 0
    """
    
    params = []
    
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND date < ?"
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        params.append(end_dt.strftime("%Y-%m-%d"))
    
    query += " GROUP BY category ORDER BY total DESC"
    
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    total = sum(r["total"] for r in rows)

    for r in rows:
        r["pct"] = round((r["total"] / total) * 100, 1) if total else 0

    return rows


@app.get("/api/summary/by-category/income")
def by_category_income(start_date: str | None = None, end_date: str | None = None):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            COALESCE(NULLIF(category, ''), 'Uncategorised') as category,
            SUM(ABS(amount)) as total
        FROM transactions
        WHERE amount > 0
    """
    
    params = []
    
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND date < ?"
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        params.append(end_dt.strftime("%Y-%m-%d"))
    
    query += " GROUP BY category ORDER BY total DESC"
    
    cursor.execute(query, params)
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
@app.get("/api/spending-targets")
def list_global_targets():
    """Get all spending targets (global, not budget-specific)"""
    return get_spending_targets(None)


@app.post("/api/spending-targets")
def add_global_target(target: SpendingTargetCreate):
    """Create a global spending target"""
    return create_spending_target(
        None,
        target.name,
        target.amount,
        target.period,
        target.categories,
    )


@app.get("/api/spending-targets/{target_id}/progress")
def global_target_progress(target_id: str):
    """Get progress for a global spending target"""
    return calculate_spending_target_progress(None, target_id)


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
@app.get("/api/saving-goals")
def list_global_goals():
    """Get all saving goals (global, not budget-specific)"""
    return get_saving_goals(None)


@app.post("/api/saving-goals")
def add_global_goal(goal: SavingGoalCreate):
    """Create a global saving goal"""
    return create_saving_goal(
        None,
        goal.name,
        goal.target_amount,
        None,
        goal.current_amount,
    )


@app.get("/api/saving-goals/{goal_id}/progress")
def global_goal_progress(goal_id: str):
    """Get progress for a global saving goal"""
    return calculate_saving_goal_progress(None, goal_id)


@app.post("/api/saving-goals")
def add_global_goal(goal: SavingGoalCreate):
    """Create a global saving goal"""
    return create_saving_goal(
        None,
        goal.name,
        goal.target_amount,
        None,
        goal.current_amount,
    )


@app.get("/api/saving-goals/{goal_id}/progress")
def global_goal_progress(goal_id: str):
    """Get progress for a global saving goal"""
    return calculate_saving_goal_progress(None, goal_id)
