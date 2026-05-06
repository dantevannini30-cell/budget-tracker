import sqlite3
import uuid
from datetime import datetime

DB_FILE = "transactions.db"

def get_connection():
    return sqlite3.connect(DB_FILE)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT,
        amount REAL,
        description TEXT,
        category TEXT,
        account_id TEXT,
        balance REAL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        start_date TEXT,
        created_at TEXT,
        transaction_count INTEGER,
        balances TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS budget_transactions (
        budget_id TEXT,
        transaction_id TEXT,
        UNIQUE(budget_id, transaction_id)
    )
    """)

    # Add balance column to transactions if it doesn't exist
    try:
        cursor.execute("ALTER TABLE transactions ADD COLUMN balance REAL")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Add balances column to budgets if it doesn't exist
    try:
        cursor.execute("ALTER TABLE budgets ADD COLUMN balances TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists

    conn.commit()
    conn.close()


def create_budget(start_date, transaction_ids):
    budget_id = uuid.uuid4().hex
    created_at = datetime.utcnow().isoformat()
    conn = get_connection()
    cursor = conn.cursor()

    # Compute balances: for each account, get the balance from the earliest transaction in the period
    balances = {}
    account_ids = set()
    for txn_id in transaction_ids:
        cursor.execute("""
            SELECT account_id
            FROM transactions
            WHERE id = ?
        """, (txn_id,))
        row = cursor.fetchone()
        if row:
            account_ids.add(row[0])

    for account_id in account_ids:
        cursor.execute("""
            SELECT balance
            FROM transactions
            WHERE account_id = ? AND date >= ? AND LOWER(description) NOT LIKE '%transfer%'
            ORDER BY date ASC
            LIMIT 1
        """, (account_id, start_date))
        row = cursor.fetchone()
        if row and row[0] is not None:
            balances[account_id] = row[0]

    import json
    balances_json = json.dumps(balances)

    cursor.execute("""
        INSERT INTO budgets (id, start_date, created_at, transaction_count, balances)
        VALUES (?, ?, ?, ?, ?)
    """, (budget_id, start_date, created_at, len(transaction_ids), balances_json))

    for txn_id in transaction_ids:
        cursor.execute("""
            INSERT OR IGNORE INTO budget_transactions (budget_id, transaction_id)
            VALUES (?, ?)
        """, (budget_id, txn_id))

    conn.commit()
    conn.close()
    return {
        "id": budget_id,
        "start_date": start_date,
        "created_at": created_at,
        "transaction_count": len(transaction_ids),
        "balances": balances,
    }


def list_budgets():
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, start_date, created_at, transaction_count
        FROM budgets
        ORDER BY created_at DESC
    """)

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def ingest_transactions(transactions):
    conn = get_connection()
    cursor = conn.cursor()

    for txn in transactions:
        cursor.execute("""
        INSERT OR IGNORE INTO transactions
        (id, date, amount, description, category, account_id, balance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            txn["_id"],
            txn["date"],
            txn["amount"],
            txn["description"],
            txn["category"],
            txn["_account"],
            txn.get("balance")
        ))

    conn.commit()
    conn.close()