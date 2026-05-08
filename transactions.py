import uuid
from database import get_connection


def add_transaction(amount, category, date):
    conn = get_connection()
    cursor = conn.cursor()

    txn_id = uuid.uuid4().hex

    cursor.execute("""
        INSERT INTO transactions (id, amount, category, date)
        VALUES (?, ?, ?, ?)
    """, (txn_id, amount, category, date))

    conn.commit()
    conn.close()

    return {
        "id": txn_id,
        "amount": amount,
        "category": category,
        "date": date
    }


def get_transactions():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM transactions ORDER BY date DESC")
    rows = cursor.fetchall()

    conn.close()

    return [dict(r) for r in rows]