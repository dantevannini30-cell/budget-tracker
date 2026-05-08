from database import get_connection


def get_spending_targets_with_progress():
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Get all targets
    cursor.execute("SELECT * FROM spending_targets")
    targets = [dict(r) for r in cursor.fetchall()]

    # 2. Get all categories in ONE query
    cursor.execute("""
        SELECT target_id, category
        FROM spending_target_categories
    """)

    category_map = {}
    for r in cursor.fetchall():
        category_map.setdefault(r["target_id"], []).append(r["category"])

    # 3. Get ALL spending in ONE query
    cursor.execute("""
        SELECT category, COALESCE(SUM(amount), 0) as spent
        FROM transactions
        GROUP BY category
    """)

    spending_map = {
        r["category"]: r["spent"] for r in cursor.fetchall()
    }

    conn.close()

    results = []

    for t in targets:
        categories = category_map.get(t["id"], [])

        spent = sum(
            spending_map.get(c, 0) for c in categories
        )

        amount = t["amount"]

        progress_pct = (spent / amount * 100) if amount else 0

        enriched = {
            **t,
            "categories": categories,
            "current_spent": spent,
            "remaining": amount - spent,
            "progress_pct": progress_pct,
            "is_over": spent > amount,
            "status": (
                "over" if spent > amount else
                "warning" if progress_pct > 90 else
                "ok"
            )
        }

        results.append(enriched)

    return results