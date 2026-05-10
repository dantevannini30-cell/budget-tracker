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
    get_accounts,
    get_account_balance_history,
    get_account_transactions,
    get_transactions as get_transactions_from_db,
    set_transaction_category,
    accept_transaction_category,
    accept_all_suggested_transaction_categories,
    classify_unset_transactions,
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


class ClassifyTransactionsRequest(BaseModel):
    limit: int | None = None
    batch_size: int | None = None


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
    account_id: str | None = None


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
    return get_transactions_from_db()


@app.post("/api/transactions/classify")
def classify_transactions(req: ClassifyTransactionsRequest | None = None):
    req = req or ClassifyTransactionsRequest()
    classified = classify_unset_transactions(req.limit, req.batch_size)
    return {
        "classified": classified,
        "transactions": get_transactions_from_db(),
    }


@app.get("/api/accounts")
def list_accounts():
    return get_accounts()


@app.get("/api/accounts/{account_id}/transactions")
def list_account_transactions(account_id: str):
    return get_account_transactions(account_id)


@app.put("/api/transactions/{transaction_id}")
def update_transaction(transaction_id: str, update: TransactionUpdate):
    conn = get_connection()
    cursor = conn.cursor()

    updates = []
    params = []

    if update.description is not None:
        updates.append("description = ?")
        params.append(update.description)

    if update.category is None and not updates:
        raise HTTPException(400, "No update provided")

    if updates:
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

    if update.category is not None:
        if not set_transaction_category(transaction_id, update.category, "human", "user"):
            raise HTTPException(404, "Transaction not found")

    return {"message": "updated"}


@app.post("/api/transactions/{transaction_id}/category/accept")
def accept_transaction_classification(transaction_id: str):
    if not accept_transaction_category(transaction_id, "user"):
        raise HTTPException(404, "Suggested category not found")

    return {"message": "accepted"}


@app.post("/api/transactions/category/accept-suggested")
def accept_suggested_transaction_classifications():
    accepted_count = accept_all_suggested_transaction_categories("user")
    return {
        "accepted": accepted_count,
        "transactions": get_transactions_from_db(),
    }


# ---------------------------
# SUMMARY
# ---------------------------


@app.get("/api/summary/by-category")
def by_category():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            SUM(-t.amount) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        GROUP BY 1
        HAVING total > 0
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
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            SUM(t.amount) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        GROUP BY 1
        HAVING total > 0
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
        goal.account_id,
    )


@app.put("/api/saving-goals/{goal_id}")
def update_goal(goal_id: str, goal: SavingGoalCreate):
    updated = update_saving_goal(
        goal_id,
        goal.name,
        goal.target_amount,
        goal.current_amount,
        goal.start_date,
        goal.account_id,
    )

    if not updated:
        raise HTTPException(404, "Saving goal not found")

    return updated


@app.get("/api/saving-goals/{goal_id}/progress")
def goal_progress(goal_id: str):
    return calculate_saving_goal_progress(goal_id)


@app.get("/api/saving-goals/{goal_id}/account-history")
def goal_account_history(
    goal_id: str,
    period: str = Query("weekly"),
    count: int = Query(8, ge=1, le=60),
):
    if period not in {"weekly", "monthly", "yearly"}:
        raise HTTPException(400, "Period must be weekly, monthly, or yearly")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT account_id
        FROM saving_goals
        WHERE id = ?
    """, (goal_id,))

    goal = cursor.fetchone()
    conn.close()

    if not goal:
        raise HTTPException(404, "Saving goal not found")

    if not goal["account_id"]:
        return {
            "goal_id": goal_id,
            "account_id": None,
            "period": period,
            "count": count,
            "points": [],
        }

    return {
        "goal_id": goal_id,
        "account_id": goal["account_id"],
        "period": period,
        "count": count,
        "points": get_account_balance_history(goal["account_id"], period, count),
    }


@app.get("/api/summary")
def summary(start_date: str = None, end_date: str = None):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            SUM(-t.amount) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        WHERE 1 = 1
    """

    params = []

    if start_date:
        query += " AND t.date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND t.date <= ?"
        params.append(end_date)

    query += " GROUP BY 1 HAVING total > 0 ORDER BY total DESC"

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
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            SUM(-t.amount) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        WHERE 1 = 1
    """

    params = []

    if start_date:
        query += " AND t.date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND t.date <= ?"
        params.append(end_date)

    query += " GROUP BY 1 HAVING total > 0 ORDER BY total DESC"

    cursor.execute(query, params)
    summary = [dict(r) for r in cursor.fetchall()]

    total_spent = sum(r["total"] for r in summary)

    for r in summary:
        r["pct"] = round((r["total"] / total_spent) * 100, 1) if total_spent else 0

    # ---------------------------
    # INCOME SUMMARY
    # ---------------------------
    income_query = """
        SELECT
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            SUM(t.amount) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.transaction_id = t.id
        WHERE 1 = 1
    """
    income_params = []

    if start_date:
        income_query += " AND t.date >= ?"
        income_params.append(start_date)

    if end_date:
        income_query += " AND t.date <= ?"
        income_params.append(end_date)

    income_query += " GROUP BY 1 HAVING total > 0 ORDER BY total DESC"

    cursor.execute(income_query, income_params)

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
