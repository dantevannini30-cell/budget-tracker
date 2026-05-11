import json
import os
import time
import urllib.error
import urllib.request
# change the import at the top — add the two new db helpers
from database import DEFAULT_USER_ID, get_known_categories
from embeddings import get_similar_examples

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:latest")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "60"))

SYSTEM_PROMPT = """
You classify personal finance transactions into concise budget categories.

Return only JSON with this exact shape:
{"category":"<category name>"}

Rules:
- Use a short human-readable category, usually 1-3 words.
- Prefer stable categories that could be reused across many transactions.
- If there is not enough information, return an empty category.
- Do not include explanations, markdown, or extra keys.

You will be given a list of existing cateogires, and should try to reuse them when appropriate. Here are some examples: Groceries, Rent, Snacks.

You will also be given examples of correctly classified transactions. Use these as guidance for how to classify new transactions, but do not feel limited by them. 
""".strip()


def get_additional_classification_context(txn, user_id):
    statement = txn.get("statement") or txn.get("description") or ""
    amount = txn.get("amount")

    categories = get_known_categories(user_id)
    examples = get_similar_examples(statement, user_id=user_id, amount=amount, limit=10)

    return {
        "existing_categories": categories,
        "examples": examples,
    }

from database import get_connection

def get_existing_classification(statement, user_id):
    """
    Checks the DB for a human-verified classification for an identical statement.
    """
    if not statement:
        return None
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # We join transactions with classifications to find a match 
    # where the status is 'accepted' or 'manual'
    query = """
        SELECT tc.category 
        FROM transactions t
        JOIN transaction_classifications tc
            ON tc.user_id = t.user_id
            AND t.id = tc.transaction_id
        WHERE t.user_id = ?
          AND t.statement = ?
          AND (tc.status = 'accepted' OR tc.status = 'manual')
        ORDER BY tc.updated_at DESC
        LIMIT 1
    """
    
    try:
        cursor.execute(query, (user_id, statement))
        row = cursor.fetchone()
        return row[0] if row else None
    finally:
        conn.close()

def classify_transaction(txn, user_id=DEFAULT_USER_ID):
    statement = txn.get("statement") or txn.get("description") or ""
    
    # --- NEW STEP: Exact Match Look-up ---
    existing_category = get_existing_classification(statement, user_id)
    if existing_category:
        print(f"[classifier] cache hit for {txn.get('id')}: {existing_category}")
        return existing_category
    # -------------------------------------

    context = get_additional_classification_context(txn, user_id)

    if not statement.strip():
        print(f"[classifier] skip {txn.get('id')}: empty statement")
        return ""

    model = resolve_model()
    if not model:
        print("[classifier] no Ollama models available")
        return ""
    payload = {
        "model": model,
        "stream": False,
        "options": {
            "temperature": 0,
            "num_predict": 40,
        },
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": build_user_prompt(statement, txn, context),
            },
        ],
        "format": "json",
    }

    try:
        print(
            f"[classifier] classify {txn.get('id')} "
            f"statement={statement[:120]!r} model={model}"
        )
        raw = call_ollama(payload, statement, txn, context, model)
        print(f"[classifier] raw response for {txn.get('id')}: {raw!r}")
        category = parse_category(raw)
        print(f"[classifier] parsed category for {txn.get('id')}: {category!r}")
        return category
    except (OSError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as err:
        print(f"[classifier] failed {txn.get('id')}: {type(err).__name__}: {err}")
        return ""


def is_classifier_available():
    tags_url = get_tags_url()

    try:
        print(f"[classifier] checking Ollama availability at {tags_url}")
        with urllib.request.urlopen(tags_url, timeout=2) as response:
            available = 200 <= response.status < 300
            print(f"[classifier] Ollama availability: {available} status={response.status}")
            return available
    except (OSError, urllib.error.URLError, TimeoutError) as err:
        print(f"[classifier] Ollama unavailable: {type(err).__name__}: {err}")
        return False


def resolve_model():
    models = get_available_models()

    if not models:
        return OLLAMA_MODEL

    if OLLAMA_MODEL in models:
        return OLLAMA_MODEL

    fallback = models[0]
    print(
        f"[classifier] configured model {OLLAMA_MODEL!r} not found; "
        f"using installed model {fallback!r}"
    )
    return fallback


def get_available_models():
    tags_url = get_tags_url()

    try:
        with urllib.request.urlopen(tags_url, timeout=2) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (OSError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
        print(f"[classifier] could not read Ollama model tags: {type(err).__name__}: {err}")
        return []

    models = [
        model.get("name")
        for model in data.get("models", [])
        if model.get("name")
    ]
    print(f"[classifier] available models: {models}")
    return models


def get_tags_url():
    return OLLAMA_URL.replace("/api/chat", "/api/tags").replace("/api/generate", "/api/tags")


def build_user_prompt(statement, txn, context):
    payload = {
        "statement": statement,
        "amount": txn.get("amount"),
        "date": txn.get("date"),
        "account_id": txn.get("_account") or txn.get("account_id"),
    }

    if context:
        if context.get("existing_categories"):
            payload["existing_categories"] = context["existing_categories"]
        if context.get("examples"):
            payload["examples"] = context["examples"]

    return json.dumps(payload, ensure_ascii=True)

def call_ollama(payload, statement, txn, context, model):
    print(f"[classifier] POST {OLLAMA_URL}")
    started_at = time.monotonic()
    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=OLLAMA_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        print(f"[classifier] chat HTTP {err.code}: {body}")

        if err.code == 404:
            return call_ollama_generate(statement, txn, context, model)

        raise

    elapsed = time.monotonic() - started_at
    print(f"[classifier] response in {elapsed:.1f}s")
    return data["message"]["content"]


def call_ollama_generate(statement, txn, context, model):
    generate_url = OLLAMA_URL.replace("/api/chat", "/api/generate")
    payload = {
        "model": model,
        "stream": False,
        "system": SYSTEM_PROMPT,
        "prompt": build_user_prompt(statement, txn, context),
        "format": "json",
        "options": {
            "temperature": 0,
            "num_predict": 40,
        },
    }

    print(f"[classifier] fallback POST {generate_url}")
    started_at = time.monotonic()
    request = urllib.request.Request(
        generate_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=OLLAMA_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        print(f"[classifier] generate HTTP {err.code}: {body}")
        raise

    elapsed = time.monotonic() - started_at
    print(f"[classifier] fallback response in {elapsed:.1f}s")
    return data["response"]


def parse_category(raw):
    parsed = json.loads(raw)
    category = parsed.get("category", "")

    if not isinstance(category, str):
        return ""

    return category.strip()

def run_test_suite(limit=10):
    print(f"--- Starting Classification Test (Limit: {limit}) ---")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Grab recent transactions
    cursor.execute("""
        SELECT id, statement, description, amount 
        FROM transactions 
        WHERE user_id = ?
        ORDER BY date DESC 
        LIMIT ?
    """, (DEFAULT_USER_ID, limit))
    
    test_txns = cursor.fetchall()
    
    results = []
    for row in test_txns:
        txn_data = {
            "id": row[0],
            "statement": row[1],
            "description": row[2],
            "amount": row[3]
        }
        
        # Run your classification logic
        category = classify_transaction(txn_data, user_id=DEFAULT_USER_ID)
        
        results.append({
            "statement": txn_data["statement"],
            "category": category if category else "FAILED"
        })

    # Print a clean summary
    print("\n--- TEST RESULTS ---")
    print(f"{'STATEMENT':<40} | {'CATEGORY'}")
    print("-" * 60)
    for res in results:
        stmt = (res['statement'][:37] + '..') if len(res['statement']) > 37 else res['statement']
        print(f"{stmt:<40} | {res['category']}")

if __name__ == "__main__":
    run_test_suite(10)
