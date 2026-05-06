import requests
import gspread
from google.oauth2.service_account import Credentials
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

AKAHU_USER_TOKEN = os.getenv("AKAHU_USER_TOKEN")
if not AKAHU_USER_TOKEN:
    raise ValueError("Missing AKAHU_USER_TOKEN in .env")

GOOGLE_CREDS_FILE = os.getenv("GOOGLE_CREDS_FILE")
if not GOOGLE_CREDS_FILE:
    raise ValueError("Missing GOOGLE_CREDS_FILE in .env")

SPREADSHEET_NAME = os.getenv("SPREADSHEET_NAME")
if not SPREADSHEET_NAME:
    raise ValueError("Missing SPREADSHEET_NAME in .env")

WORKSHEET_NAME = os.getenv("WORKSHEET_NAME")
if not WORKSHEET_NAME:
    raise ValueError("Missing WORKSHEET_NAME in .env")

YOUR_APP_TOKEN = os.getenv("YOUR_APP_TOKEN")
if not YOUR_APP_TOKEN:
    raise ValueError("Missing YOUR_APP_TOKEN in .env")

DATE_CUTOFF = os.getenv("DATE_CUTOFF")
# ---------------------------
# 1. Fetch transactions
# ---------------------------
def fetch_transactions():
    url = "https://api.akahu.io/v1/transactions"

    headers = {
        "Authorization": f"Bearer {AKAHU_USER_TOKEN}",
        "X-Akahu-ID": YOUR_APP_TOKEN
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        print("Error fetching transactions:", response.text)
        return []

    data = response.json()
    transactions = data.get("items", [])

    # Apply date cutoff
    if DATE_CUTOFF:
        cutoff_date = datetime.strptime(DATE_CUTOFF, "%Y-%m-%d")

        filtered = []
        for txn in transactions:
            txn_date = datetime.fromisoformat(txn["date"].replace("Z", ""))
            if txn_date > cutoff_date:
                filtered.append(txn)

        return filtered

    return transactions


def fetch_in_range(start_date, end_date):
    url = "https://api.akahu.io/v1/transactions"

    headers = {
        "Authorization": f"Bearer {AKAHU_USER_TOKEN}",
        "X-Akahu-ID": YOUR_APP_TOKEN
    }

    all_transactions = []
    cursor = None

    while True:
        params = {
            "start": start_date,
            "end": end_date
        }

        if cursor:
            params["cursor"] = cursor

        response = requests.get(url, headers=headers, params=params)

        if response.status_code != 200:
            print("Error fetching transactions:", response.text)
            break

        data = response.json()
        items = data.get("items", [])

        for txn in items:
            if txn.get("pending"):
                continue
            all_transactions.append(txn)

        print(f"Fetched {len(items)} txns (total {len(all_transactions)})")

        cursor = data.get("cursor", {}).get("next")
        if not cursor:
            break

    return all_transactions


def format_row(transaction):
    raw_date = transaction.get("date")
    description = transaction.get("description")
    amount = transaction.get("amount")
    txn_id = transaction.get("_id")

    # Convert date → DD/MM/YYYY
    date_obj = datetime.fromisoformat(raw_date.replace("Z", ""))
    formatted_date = date_obj.strftime("%d/%m/%Y")

    return [
        formatted_date,
        description,
        amount,
        "",  # category
        txn_id
    ]


def simple_filter(transactions):
    filtered = []
    for txn in transactions:
        desc = txn.get("description", "").lower()

        if "transfer" in desc:
            continue

        filtered.append(txn)
    return filtered
# ---------------------------
# 4. Push to sheet
# ---------------------------
def push_transactions(sheet, transactions):
    # Get all existing IDs (column 5)
    existing_ids = set(sheet.col_values(5)[1:])  # skip header

    rows = []

    for txn in transactions:
        txn_id = txn.get("_id")

        if txn_id in existing_ids:
            continue  # skip duplicate

        row = format_row(txn)
        rows.append(row)

    if rows:
        sheet.append_rows(rows)
        print(f"Added {len(rows)} new rows.")
    else:
        print("No new rows to add.")


# ---------------------------
# 5. Main flow
# ---------------------------
from utils import clean_transactions
from database import init_db, ingest_transactions

def main():
    print("Initialising DB...")
    init_db()

    print("Fetching transactions...")
    raw_transactions = fetch_transactions()

    print("Cleaning transactions...")
    cleaned = clean_transactions(raw_transactions)

    print("Ingesting into database...")
    ingest_transactions(cleaned)

    print("Done.")

if __name__ == "__main__":
    main()
    # transactions = fetch_in_range("2026-01-01", "2026-05-01")
    # print(transactions)