import requests
import gspread
from google.oauth2.service_account import Credentials
import os
from dotenv import load_dotenv

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
# ---------------------------
# 1. Fetch transactions
# ---------------------------
def fetch_transactions():
    url = "https://api.akahu.io/v1/transactions"

    headers = {
        "Authorization": f"Bearer {AKAHU_USER_TOKEN}"
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        print("Error fetching transactions:", response.text)
        return []

    data = response.json()

    # Akahu returns "items"
    return data.get("items", [])


# ---------------------------
# 2. Connect to Google Sheets
# ---------------------------
def connect_to_sheet():
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]

    creds = Credentials.from_service_account_file(
        GOOGLE_CREDS_FILE,
        scopes=scopes
    )

    client = gspread.authorize(creds)

    sheet = client.open(SPREADSHEET_NAME).worksheet(WORKSHEET_NAME)

    return sheet


# ---------------------------
# 3. Format transaction row
# ---------------------------
def format_row(transaction):
    date = transaction.get("date")
    description = transaction.get("description")
    amount = transaction.get("amount")

    return [
        date,
        description,
        amount,
        ""  # category left blank intentionally
    ]


# ---------------------------
# 4. Push to sheet
# ---------------------------
def push_transactions(sheet, transactions):
    for txn in transactions:
        row = format_row(txn)
        sheet.append_row(row)
        print("Added:", row)


# ---------------------------
# 5. Main flow
# ---------------------------
def main():
    print("Fetching transactions...")
    transactions = fetch_transactions()

    if not transactions:
        print("No transactions found.")
        return

    print(f"Fetched {len(transactions)} transactions.")

    print("Connecting to Google Sheets...")
    sheet = connect_to_sheet()

    print("Pushing to sheet...")
    push_transactions(sheet, transactions)

    print("Done.")


if __name__ == "__main__":
    main()