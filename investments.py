# ---------------------------
# INVESTMENTS
# ---------------------------
from database import get_connection, now_iso, today_iso, build_weekly_projection_periods
import uuid

def create_investment(user_id, name, type=None, start_date=None, active=True):
    conn = get_connection()
    cursor = conn.cursor()

    investment_id = uuid.uuid4().hex
    timestamp = now_iso()
    start_date = start_date or today_iso()

    cursor.execute("""
        INSERT INTO investments (
            id, user_id, name, type, start_date, active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        investment_id,
        user_id,
        name,
        (type or "").strip(),
        start_date,
        1 if active else 0,
        timestamp,
        timestamp,
    ))

    conn.commit()
    conn.close()
    return get_investment(user_id, investment_id)


def update_investment(user_id, investment_id, name, type=None, start_date=None, active=True):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE investments
        SET
            name = ?,
            type = ?,
            start_date = ?,
            active = ?,
            updated_at = ?
        WHERE id = ?
        AND user_id = ?
    """, (
        name,
        (type or "").strip(),
        start_date or today_iso(),
        1 if active else 0,
        now_iso(),
        investment_id,
        user_id,
    ))

    if cursor.rowcount == 0:
        conn.close()
        return None

    conn.commit()
    conn.close()
    return get_investment(user_id, investment_id)


def delete_investment(user_id, investment_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM investment_values WHERE user_id = ? AND investment_id = ?",
        (user_id, investment_id),
    )
    cursor.execute("DELETE FROM investments WHERE user_id = ? AND id = ?", (user_id, investment_id))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def create_investment_value(user_id, investment_id, amount, value_date=None, note=None, source="manual"):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM investments WHERE user_id = ? AND id = ?", (user_id, investment_id))
    if not cursor.fetchone():
        conn.close()
        return None

    value_id = uuid.uuid4().hex
    cursor.execute("""
        INSERT INTO investment_values (
            id, user_id, investment_id, amount, value_date, note, source, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        value_id,
        user_id,
        investment_id,
        amount,
        value_date or today_iso(),
        note or "",
        (source or "manual").strip() or "manual",
        now_iso(),
    ))

    conn.commit()
    conn.close()
    return get_investment(user_id, investment_id)


def delete_investment_value(user_id, investment_id, value_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM investment_values
        WHERE user_id = ?
        AND id = ?
        AND investment_id = ?
    """, (user_id, value_id, investment_id))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_investment(user_id, investment_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM investments WHERE user_id = ? AND id = ?", (user_id, investment_id))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return None

    investment = enrich_investment(cursor, user_id, dict(row))
    conn.close()
    return investment


def get_investments(user_id, active_only=False):
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM investments WHERE user_id = ?"
    params = [user_id]

    if active_only:
        query += " AND active = ?"
        params.append(1)

    query += " ORDER BY active DESC, name COLLATE NOCASE ASC"

    cursor.execute(query, params)
    investments = [enrich_investment(cursor, user_id, dict(row)) for row in cursor.fetchall()]

    conn.close()
    return investments


def enrich_investment(cursor, user_id, investment):
    values = get_investment_values(cursor, user_id, investment["id"])
    latest = values[0] if values else None

    return {
        **investment,
        "active": bool(investment.get("active")),
        "values": values,
        "latest_value": float(latest["amount"] or 0) if latest else 0,
        "latest_value_date": latest["value_date"] if latest else None,
        "latest_value_source": latest["source"] if latest else None,
    }


def get_investment_values(cursor, user_id, investment_id):
    cursor.execute("""
        SELECT id, investment_id, amount, value_date, note, source, created_at
        FROM investment_values
        WHERE user_id = ?
        AND investment_id = ?
        ORDER BY value_date DESC, created_at DESC
    """, (user_id, investment_id))

    return [dict(row) for row in cursor.fetchall()]


def get_current_investment_value(cursor, user_id):
    return get_investment_value_at_date(cursor, user_id, today_iso())


def get_investment_value_by_week(cursor, user_id, today, history_count):
    periods = build_weekly_projection_periods(today, history_count)
    return {
        period["end_date"]: get_investment_value_at_date(cursor, user_id, period["end_date"])
        for period in periods
    }


def get_investment_value_at_date(cursor, user_id, end_date):
    cursor.execute("""
        SELECT id, start_date
        FROM investments
        WHERE user_id = ?
        AND active = 1
    """, (user_id,))
    investments = [dict(row) for row in cursor.fetchall()]

    total = 0
    for investment in investments:
        if investment.get("start_date") and investment["start_date"] > end_date:
            continue

        cursor.execute("""
            SELECT amount
            FROM investment_values
            WHERE user_id = ?
            AND investment_id = ?
            AND value_date <= ?
            ORDER BY value_date DESC, created_at DESC
            LIMIT 1
        """, (user_id, investment["id"], end_date))

        row = cursor.fetchone()
        if row and row["amount"] is not None:
            total += float(row["amount"] or 0)

    return total

