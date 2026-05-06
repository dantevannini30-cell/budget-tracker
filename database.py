import sqlite3

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
        account_id TEXT
    )
    """)

    conn.commit()
    conn.close()


def ingest_transactions(transactions):
    conn = get_connection()
    cursor = conn.cursor()

    for txn in transactions:
        cursor.execute("""
        INSERT OR IGNORE INTO transactions
        (id, date, amount, description, category, account_id)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            txn["_id"],
            txn["date"],
            txn["amount"],
            txn["description"],
            "",  # category (empty for now)
            txn["_account"]
        ))

    conn.commit()
    conn.close()