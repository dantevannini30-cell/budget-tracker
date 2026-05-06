from datetime import datetime

def clean_transactions(transactions):
    cleaned = []

    for txn in transactions:
        # Skip pending
        if txn.get("pending"):
            continue

        cleaned.append({
            "_id": txn["_id"],
            "date": txn["date"],
            "amount": txn["amount"],
            "description": txn.get("description", ""),
            "_account": txn["_account"]
        })

    return cleaned