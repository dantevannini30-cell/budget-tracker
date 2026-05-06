from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from datetime import datetime

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
        SELECT id, date, amount, description, category, account_id
        FROM transactions
        ORDER BY date DESC
        LIMIT 50
    """)

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return rows


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