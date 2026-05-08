import hashlib


def get_transaction_id(txn):
    return get_external_transaction_id(txn) or stable_transaction_id(txn)


def get_external_transaction_id(txn):
    txn_id = (
        txn.get("id")
        or txn.get("_id")
        or txn.get("transaction_id")
        or txn.get("akahu_id")
    )
    if isinstance(txn_id, str) and txn_id.startswith("akh_fallback_"):
        return None
    return txn_id


def stable_transaction_id(txn):
    parts = [
        str(txn.get("_account") or txn.get("account_id") or txn.get("account") or ""),
        str(txn.get("date") or ""),
        str(txn.get("amount") or ""),
        str(txn.get("description") or txn.get("statement") or ""),
    ]
    fingerprint = "\x1f".join(parts)
    digest = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()
    return f"akh_fallback_{digest[:32]}"
