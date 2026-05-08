import json
import os
import urllib.error
import urllib.request
# change the import at the top — add the two new db helpers
from database import get_known_categories, get_similar_examples

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:latest")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "5"))

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


def get_additional_classification_context(txn):
    statement = txn.get("statement") or txn.get("description") or ""
    amount = txn.get("amount")

    categories = get_known_categories()
    examples = get_similar_examples(statement, amount=amount)

    return {
        "existing_categories": categories,
        "examples": examples,
    }


def classify_transaction(txn):
    statement = txn.get("statement") or txn.get("description") or ""
    context = get_additional_classification_context(txn)

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

    return data["message"]["content"]


def call_ollama_generate(statement, txn, context, model):
    generate_url = OLLAMA_URL.replace("/api/chat", "/api/generate")
    payload = {
        "model": model,
        "stream": False,
        "system": SYSTEM_PROMPT,
        "prompt": build_user_prompt(statement, txn, context),
        "format": "json",
    }

    print(f"[classifier] fallback POST {generate_url}")
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

    return data["response"]


def parse_category(raw):
    parsed = json.loads(raw)
    category = parsed.get("category", "")

    if not isinstance(category, str):
        return ""

    return category.strip()
