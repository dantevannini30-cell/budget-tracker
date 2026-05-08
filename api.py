from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import json
from datetime import datetime, timedelta, timezone
from main import fetch_in_range
from utils import clean_transactions
from database import (
    init_db,
    ingest_transactions,
    create_spending_target,
    get_spending_targets,
    create_saving_goal,
    get_saving_goal,
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

class LoadTransactionsRequest(BaseModel):
    start_date: str
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
@app.post("/api/transactions/load")
def load_transactions(req: LoadTransactionsRequest):
    """
    Fetch → clean → store → return inserted transactions
    """

    # 1. fetch transactions
    transactions = fetch_in_range(
        req.start_date,
        req.end_date if hasattr(req, "end_date") else None
    )

    # 2. clean them
    cleaned = clean_transactions(transactions)

    # 3. store in DB
    ingest_transactions(cleaned)

    # 4. RETURN ACTUAL DATA (this is the fix)
    return cleaned


@app.get("/api/transactions")
def get_transactions():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            id,
            date,
            amount,
            description,
            category,
            statement,
            account_id
        FROM transactions
        WHERE LOWER(COALESCE(statement, description)) NOT LIKE '%transfer%'
        ORDER BY date DESC
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
        conn.close()
        raise HTTPException(status_code=404, detail="Transaction not found")

    conn.commit()
    conn.close()

    return {"message": "updated"}


# ---------------------------
# SUMMARY
# ---------------------------

@app.get("/api/summary")
def summary(
    start_date: str | None = None,
    end_date: str | None = None,
):
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

        end_dt = (
            datetime.strptime(end_date, "%Y-%m-%d")
            + timedelta(days=1)
        )

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
# SPENDING BY CATEGORY
# ---------------------------

@app.get("/api/summary/by-category")
def by_category(
    start_date: str | None = None,
    end_date: str | None = None,
):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            COALESCE(NULLIF(category, ''), 'Uncategorised') AS category,
            SUM(ABS(amount)) AS total
        FROM transactions
        WHERE amount < 0
    """

    params = []

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND date < ?"

        end_dt = (
            datetime.strptime(end_date, "%Y-%m-%d")
            + timedelta(days=1)
        )

        params.append(end_dt.strftime("%Y-%m-%d"))

    query += """
        GROUP BY category
        ORDER BY total DESC
    """

    cursor.execute(query, params)

    rows = [dict(r) for r in cursor.fetchall()]

    conn.close()

    total = sum(r["total"] for r in rows)

    for r in rows:
        r["pct"] = (
            round((r["total"] / total) * 100, 1)
            if total
            else 0
        )

    return rows


# ---------------------------
# INCOME BY CATEGORY
# ---------------------------

@app.get("/api/summary/by-category/income")
def by_category_income(
    start_date: str | None = None,
    end_date: str | None = None,
):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            COALESCE(NULLIF(category, ''), 'Uncategorised') AS category,
            SUM(ABS(amount)) AS total
        FROM transactions
        WHERE amount > 0
    """

    params = []

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND date < ?"

        end_dt = (
            datetime.strptime(end_date, "%Y-%m-%d")
            + timedelta(days=1)
        )

        params.append(end_dt.strftime("%Y-%m-%d"))

    query += """
        GROUP BY category
        ORDER BY total DESC
    """

    cursor.execute(query, params)

    rows = [dict(r) for r in cursor.fetchall()]

    conn.close()

    total = sum(r["total"] for r in rows)

    for r in rows:
        r["pct"] = (
            round((r["total"] / total) * 100, 1)
            if total
            else 0
        )

    return rows


# =========================
# SPENDING TARGETS
# =========================

@app.get("/api/spending-targets")
def list_targets():
    return get_spending_targets(None)


@app.post("/api/spending-targets")
def create_target(target: SpendingTargetCreate):
    return create_spending_target(
        None,
        target.name,
        target.amount,
        target.period,
        target.categories,
    )


@app.get("/api/spending-targets/{target_id}/progress")
def target_progress(target_id: str):
    if not target_id:
        raise HTTPException(400, "Missing target_id")

    return calculate_spending_target_progress(
        target_id,
    )


# =========================
# SAVING GOALS
# =========================

@app.get("/api/saving-goals")
def list_goals():
    return get_saving_goal(None)


@app.post("/api/saving-goals")
def create_goal(goal: SavingGoalCreate):
    return create_saving_goal(
        None,
        goal.name,
        goal.target_amount,
        None,
        goal.current_amount,
    )


@app.get("/api/saving-goals/{goal_id}/progress")
def goal_progress(goal_id: str):
    if not goal_id:
        raise HTTPException(400, "Missing goal_id")

    return calculate_saving_goal_progress(
        None,
        goal_id,
    )