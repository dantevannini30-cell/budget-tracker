from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import uuid
from datetime import datetime, timedelta
from database import init_db, create_budget, ingest_transactions
import json

init_db()

app = FastAPI()

# Allow React dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default port
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "transactions.db"

def get_connection():
    return sqlite3.connect(DB_FILE)


# ---------------------------
# TEST ENDPOINT 1
# Just returns some hardcoded data — proves the connection works
# ---------------------------
@app.get("/api/hello")
def hello():
    return {"message": "FastAPI is working!", "time": datetime.now().isoformat()}


# ---------------------------
# TEST ENDPOINT 2
# Reads real data from your SQLite database
# ---------------------------
@app.get("/api/transactions")
def get_transactions():
    conn = get_connection()
    conn.row_factory = sqlite3.Row  # lets us return dicts instead of tuples
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, date, amount, description, category, statement, account_id
        FROM transactions
        WHERE LOWER(COALESCE(statement, description)) NOT LIKE '%transfer%'
        ORDER BY date DESC
        LIMIT 50
    """)

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return rows


class BudgetCreate(BaseModel):
    start_date: str


class CategoryUpdate(BaseModel):
    category: str | None = None
    description: str | None = None


@app.get("/api/budgets")
def get_budgets():
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, start_date, created_at, transaction_count, balances
        FROM budgets
        ORDER BY created_at DESC
    """)

    rows = [dict(row) for row in cursor.fetchall()]
    for row in rows:
        row["balances"] = json.loads(row["balances"]) if row["balances"] else {}
    conn.close()
    return rows


@app.post("/api/budgets")
def create_budget_endpoint(budget: BudgetCreate):
    try:
        datetime.strptime(budget.start_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="start_date must be YYYY-MM-DD")

    # Fetch, clean, and ingest transactions from Akahu before creating budget
    try:
        from main import fetch_transactions
        from utils import clean_transactions
        
        raw_transactions = fetch_transactions(start_date=budget.start_date)
        cleaned = clean_transactions(raw_transactions)
        ingest_transactions(cleaned)
    except Exception as e:
        print(f"Warning: Could not fetch/ingest transactions: {e}")
        # Continue anyway - use existing data in DB

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id
        FROM transactions
        WHERE date >= ?
          AND LOWER(COALESCE(statement, description)) NOT LIKE '%transfer%'
        ORDER BY date DESC
    """, (budget.start_date,))

    transaction_ids = [row[0] for row in cursor.fetchall()]
    conn.close()

    return create_budget(budget.start_date, transaction_ids)


@app.get("/api/budgets/{budget_id}/summary")
def budget_summary(budget_id: str):
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, start_date, created_at, transaction_count, balances
        FROM budgets
        WHERE id = ?
    """, (budget_id,))

    budget = cursor.fetchone()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = dict(budget)
    budget["balances"] = json.loads(budget["balances"]) if budget["balances"] else {}

    cursor.execute("""
        SELECT t.amount, t.date
        FROM transactions t
        JOIN budget_transactions bt ON bt.transaction_id = t.id
        WHERE bt.budget_id = ?
          AND LOWER(COALESCE(t.statement, t.description)) NOT LIKE '%transfer%'
    """, (budget_id,))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    total_in = sum(row["amount"] for row in rows if row["amount"] > 0)
    total_out = sum(abs(row["amount"]) for row in rows if row["amount"] < 0)
    net = total_in - total_out

    cutoff = (datetime.utcnow() - timedelta(days=7)).date().isoformat()
    last_week_rows = [row for row in rows if row["date"][:10] >= cutoff]
    last_week_in = sum(row["amount"] for row in last_week_rows if row["amount"] > 0)
    last_week_out = sum(abs(row["amount"]) for row in last_week_rows if row["amount"] < 0)
    last_week_net = last_week_in - last_week_out

    total_balance = sum(budget["balances"].values()) if budget["balances"] else 0

    return {
        **budget,
        "summary": {
            "all": {
                "total_in": round(total_in, 2),
                "total_out": round(total_out, 2),
                "net": round(net, 2),
                "total_balance": round(total_balance, 2),
            },
            "last_week": {
                "total_in": round(last_week_in, 2),
                "total_out": round(last_week_out, 2),
                "net": round(last_week_net, 2),
            },
        },
    }


@app.get("/api/budgets/{budget_id}/uncategorized-transactions")
def get_uncategorized_transactions(budget_id: str):
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT t.id, t.date, t.amount, t.description, t.category, t.statement, t.account_id
        FROM transactions t
        JOIN budget_transactions bt ON bt.transaction_id = t.id
        WHERE bt.budget_id = ?
          AND (t.category IS NULL OR t.category = '')
          AND LOWER(COALESCE(t.statement, t.description)) NOT LIKE '%transfer%'
        ORDER BY t.date DESC
    """, (budget_id,))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


@app.get("/api/budgets/{budget_id}/transactions")
def get_budget_transactions(budget_id: str):
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT t.id, t.date, t.amount, t.description, t.category, t.statement, t.account_id
        FROM transactions t
        JOIN budget_transactions bt ON bt.transaction_id = t.id
        WHERE bt.budget_id = ?
          AND LOWER(COALESCE(t.statement, t.description)) NOT LIKE '%transfer%'
        ORDER BY t.date DESC
    """, (budget_id,))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


@app.put("/api/transactions/{transaction_id}/category")
def update_transaction_category(transaction_id: str, update: CategoryUpdate):
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
        conn.close()
        raise HTTPException(status_code=400, detail="No category or description provided")

    query = f"UPDATE transactions SET {', '.join(updates)} WHERE id = ?"
    params.append(transaction_id)
    cursor.execute(query, params)

    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Transaction not found")

    conn.commit()
    conn.close()
    return {"message": "Transaction updated"}


# ---------------------------
# TEST ENDPOINT 3
# Returns spending totals by category — ready to feed a pie chart
# ---------------------------
@app.get("/api/summary/by-category")
def spending_by_category():
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COALESCE(NULLIF(category, ''), 'Uncategorised') as category,
            ROUND(SUM(ABS(amount)), 2) as total
        FROM transactions
        WHERE amount < 0
          AND LOWER(COALESCE(statement, description)) NOT LIKE '%transfer%'
        GROUP BY category
        ORDER BY total DESC
    """)

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # Calculate percentages
    grand_total = sum(r["total"] for r in rows)
    for row in rows:
        row["pct"] = round((row["total"] / grand_total) * 100, 1) if grand_total else 0

    return rows