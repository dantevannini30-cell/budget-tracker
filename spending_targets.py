import uuid
from database import get_connection


def create_spending_target(name, amount, period, categories):
    conn = get_connection()
    cursor = conn.cursor()

    target_id = uuid.uuid4().hex

    cursor.execute("""
        INSERT INTO spending_targets (id, name, amount, period)
        VALUES (?, ?, ?, ?)
    """, (target_id, name, amount, period))

    for c in categories:
        cursor.execute("""
            INSERT OR IGNORE INTO spending_target_categories (target_id, category)
            VALUES (?, ?)
        """, (target_id, c))

    conn.commit()
    conn.close()

    return {
        "id": target_id,
        "name": name,
        "amount": amount,
        "period": period,
        "categories": categories,
    }


def get_spending_targets():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM spending_targets")
    targets = cursor.fetchall()

    result = []

    for t in targets:
        target = dict(t)

        cursor.execute("""
            SELECT category
            FROM spending_target_categories
            WHERE target_id = ?
        """, (t["id"],))

        target["categories"] = [r["category"] for r in cursor.fetchall()]
        result.append(target)

    conn.close()
    return result