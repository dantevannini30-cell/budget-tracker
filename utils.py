from datetime import datetime


def categorise_transaction(transaction):
    return "" #Impliment this later with LLM as judhge to categorise 


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
            "category": categorise_transaction(txn),
            "_account": txn["_account"]
        })

    return cleaned