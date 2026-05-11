import uuid
from database import DEFAULT_USER_ID, get_connection


def add_transaction(amount, category, date, user_id=DEFAULT_USER_ID):
    conn = get_connection()
    cursor = conn.cursor()

    txn_id = uuid.uuid4().hex

    cursor.execute("""
        INSERT INTO transactions (user_id, id, amount, category, date)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, txn_id, amount, category, date))

    conn.commit()
    conn.close()

    return {
        "id": txn_id,
        "amount": amount,
        "category": category,
        "date": date
    }


def get_transactions(user_id=DEFAULT_USER_ID):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC",
        (user_id,),
    )
    rows = cursor.fetchall()

    conn.close()

    return [dict(r) for r in rows]
