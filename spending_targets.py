import uuid
from database import DEFAULT_USER_ID, get_connection


def create_spending_target(name, amount, period, categories, user_id=DEFAULT_USER_ID):
    conn = get_connection()
    cursor = conn.cursor()

    target_id = uuid.uuid4().hex

    cursor.execute("""
        INSERT INTO spending_targets (id, user_id, name, amount, period)
        VALUES (?, ?, ?, ?, ?)
    """, (target_id, user_id, name, amount, period))

    for c in categories:
        cursor.execute("""
            INSERT OR IGNORE INTO spending_target_categories (user_id, target_id, category)
            VALUES (?, ?, ?)
        """, (user_id, target_id, c))

    conn.commit()
    conn.close()

    return {
        "id": target_id,
        "name": name,
        "amount": amount,
        "period": period,
        "categories": categories,
    }


def get_spending_targets(user_id=DEFAULT_USER_ID):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM spending_targets WHERE user_id = ?", (user_id,))
    targets = cursor.fetchall()

    result = []

    for t in targets:
        target = dict(t)

        cursor.execute("""
            SELECT category
            FROM spending_target_categories
            WHERE user_id = ?
            AND target_id = ?
        """, (user_id, t["id"]))

        target["categories"] = [r["category"] for r in cursor.fetchall()]
        result.append(target)

    conn.close()
    return result
