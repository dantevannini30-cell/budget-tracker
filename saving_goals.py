import uuid
from database import get_connection


def create_saving_goal(name, target_amount, current_amount=0):
    conn = get_connection()
    cursor = conn.cursor()

    goal_id = uuid.uuid4().hex

    cursor.execute("""
        INSERT INTO saving_goals (id, name, target_amount, current_amount)
        VALUES (?, ?, ?, ?)
    """, (goal_id, name, target_amount, current_amount))

    conn.commit()
    conn.close()

    return {
        "id": goal_id,
        "name": name,
        "target_amount": target_amount,
        "current_amount": current_amount,
    }


def get_saving_goals():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM saving_goals")
    rows = cursor.fetchall()

    conn.close()

    return [dict(r) for r in rows]