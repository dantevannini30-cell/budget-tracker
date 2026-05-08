from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone

from main import fetch_in_range
from utils import clean_transactions
from database import (
    init_db,
    get_connection,
    ingest_transactions,
    get_latest_transaction_date,
    create_spending_target,
    update_spending_target,
    get_spending_targets_with_progress,
    create_saving_goal,
    update_saving_goal,
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

@app.on_event("startup")
def startup():
    init_db()


# ---------------------------
# MODELS
# ---------------------------

class TransactionUpdate(BaseModel):
    category: str | None = None
    description: str | None = None


class LoadTransactionsRequest(BaseModel):
    start_date: str
    end_date: str | None = None


class SpendingTargetCreate(BaseModel):
    name: str
    amount: float
    period: str
    categories: list[str]
    start_date: str | None = None


class SavingGoalCreate(BaseModel):
    name: str
    target_amount: float
    current_amount: float = 0
    start_date: str | None = None


# ---------------------------
# HEALTH
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

def utc_now_for_akahu():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


@app.post("/api/transactions/load")
def load_transactions(req: LoadTransactionsRequest):

    transactions = fetch_in_range(req.start_date, req.end_date or utc_now_for_akahu())
    cleaned = clean_transactions(transactions)
    inserted_ids = set(ingest_transactions(cleaned))

    return [txn for txn in cleaned if txn["id"] in inserted_ids]


@app.post("/api/transactions/refresh")
def refresh_transactions():
    latest_date = get_latest_transaction_date()

    if not latest_date:
        raise HTTPException(400, "No existing transactions. Choose a start date first.")

    transactions = fetch_in_range(latest_date, utc_now_for_akahu())
    cleaned = clean_transactions(transactions)
    inserted_ids = set(ingest_transactions(cleaned))

    return {
        "start_date": latest_date,
        "transactions": [txn for txn in cleaned if txn["id"] in inserted_ids],
    }


@app.get("/api/transactions")
def get_transactions():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
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
        raise HTTPException(400, "No update provided")

    query = f"""
        UPDATE transactions
        SET {', '.join(updates)}
        WHERE id = ?
    """

    params.append(transaction_id)

    cursor.execute(query, params)

    if cursor.rowcount == 0:
        raise HTTPException(404, "Transaction not found")

    conn.commit()
    conn.close()

    return {"message": "updated"}


# ---------------------------
# SUMMARY
# ---------------------------


@app.get("/api/summary/by-category")
def by_category():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COALESCE(NULLIF(category, ''), 'Uncategorised') AS category,
            SUM(ABS(amount)) AS total
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


@app.get("/api/summary/by-category/income")
def by_category_income():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COALESCE(NULLIF(category, ''), 'Uncategorised') AS category,
            SUM(ABS(amount)) AS total
        FROM transactions
        WHERE amount > 0
        GROUP BY category
        ORDER BY total DESC
    """)

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    total = sum(r["total"] for r in rows)

    for r in rows:
        r["pct"] = round((r["total"] / total) * 100, 1) if total else 0

    return rows


@app.get("/api/spending-targets")
def list_targets():
    return get_spending_targets_with_progress()


@app.post("/api/spending-targets")
def create_target(target: SpendingTargetCreate):
    return create_spending_target(
        target.name,
        target.amount,
        target.period,
        target.categories,
        target.start_date,
    )


@app.put("/api/spending-targets/{target_id}")
def update_target(target_id: str, target: SpendingTargetCreate):
    updated = update_spending_target(
        target_id,
        target.name,
        target.amount,
        target.period,
        target.categories,
        target.start_date,
    )

    if not updated:
        raise HTTPException(404, "Spending target not found")

    return updated


@app.get("/api/spending-targets/{target_id}/progress")
def target_progress(target_id: str):
    return calculate_spending_target_progress(target_id)


# ---------------------------
# SAVING GOALS
# ---------------------------

@app.get("/api/saving-goals")
def list_goals():
    return get_saving_goals()


@app.post("/api/saving-goals")
def create_goal(goal: SavingGoalCreate):
    return create_saving_goal(
        goal.name,
        goal.target_amount,
        goal.current_amount,
        goal.start_date,
    )


@app.put("/api/saving-goals/{goal_id}")
def update_goal(goal_id: str, goal: SavingGoalCreate):
    updated = update_saving_goal(
        goal_id,
        goal.name,
        goal.target_amount,
        goal.current_amount,
        goal.start_date,
    )

    if not updated:
        raise HTTPException(404, "Saving goal not found")

    return updated


@app.get("/api/saving-goals/{goal_id}/progress")
def goal_progress(goal_id: str):
    return calculate_saving_goal_progress(goal_id)


@app.get("/api/summary")
def summary(start_date: str = None, end_date: str = None):
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
        query += " AND date <= ?"
        params.append(end_date)

    query += " GROUP BY category ORDER BY total DESC"

    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]

    conn.close()

    total = sum(r["total"] for r in rows)

    for r in rows:
        r["pct"] = round((r["total"] / total) * 100, 1) if total else 0

    return rows


@app.get("/api/dashboard")
def dashboard(
    start_date: str = Query(None),
    end_date: str = Query(None),
):
    conn = get_connection()
    cursor = conn.cursor()

    # ---------------------------
    # SUMMARY (expenses)
    # ---------------------------
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
        query += " AND date <= ?"
        params.append(end_date)

    query += " GROUP BY category ORDER BY total DESC"

    cursor.execute(query, params)
    summary = [dict(r) for r in cursor.fetchall()]

    total_spent = sum(r["total"] for r in summary)

    for r in summary:
        r["pct"] = round((r["total"] / total_spent) * 100, 1) if total_spent else 0

    # ---------------------------
    # INCOME SUMMARY
    # ---------------------------
    cursor.execute("""
        SELECT
            COALESCE(NULLIF(category, ''), 'Uncategorised') AS category,
            SUM(ABS(amount)) AS total
        FROM transactions
        WHERE amount > 0
        GROUP BY category
        ORDER BY total DESC
    """)

    income_summary = [dict(r) for r in cursor.fetchall()]

    total_income = sum(r["total"] for r in income_summary)

    for r in income_summary:
        r["pct"] = round((r["total"] / total_income) * 100, 1) if total_income else 0

    conn.close()

    # ---------------------------
    # ENRICHED DATA
    # ---------------------------
    spending_targets = get_spending_targets_with_progress()
    saving_goals = get_saving_goals()

    return {
        "summary": summary,
        "income_summary": income_summary,
        "spending_targets": spending_targets,
        "saving_goals": saving_goals,
        "date_range": {
            "start_date": start_date,
            "end_date": end_date,
        }
    }
