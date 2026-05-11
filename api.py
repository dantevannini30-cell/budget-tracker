from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone

from main import fetch_in_range
from utils import clean_transactions
from database import (
    DEFAULT_USER_ID,
    init_db,
    get_connection,
    ingest_transactions,
    get_latest_transaction_date,
    get_accounts,
    update_account_name,
    get_account_balance_history,
    get_account_transactions,
    get_transactions as get_transactions_from_db,
    set_transaction_category,
    accept_transaction_category,
    accept_all_suggested_transaction_categories,
    classify_unset_transactions,
    create_spending_target,
    update_spending_target,
    get_spending_targets_with_progress,
    create_saving_goal,
    update_saving_goal,
    get_saving_goals,
    create_recurring_rule,
    update_recurring_rule,
    delete_recurring_rule,
    get_recurring_rules,
    get_categories_with_recurring,
    get_category_transactions,
    get_net_worth_projection,
    set_category_income,
    set_category_recurring,
    get_recurring_cashflow_history,
    create_debt,
    update_debt,
    delete_debt,
    get_debts,
    create_debt_payment,
    delete_debt_payment,
    create_investment,
    update_investment,
    delete_investment,
    get_investments,
    create_investment_value,
    delete_investment_value,
    create_category_allocation,
    delete_category_allocation,
    get_category_allocations,
    apply_allocations_to_category_totals,
)

from utils import (
    calculate_spending_target_progress,
    calculate_saving_goal_progress,
)

# ---------------------------
# INIT
# ---------------------------

init_db()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_user_id(x_user_id: str | None = Header(default=None)):
    return (x_user_id or DEFAULT_USER_ID).strip() or DEFAULT_USER_ID

@app.on_event("startup")
def startup():
    init_db()


# ---------------------------
# MODELS
# ---------------------------

class TransactionUpdate(BaseModel):
    category: str | None = None
    description: str | None = None


class LoadTransactionsRequest(BaseModel):
    start_date: str
    end_date: str | None = None


class ClassifyTransactionsRequest(BaseModel):
    limit: int | None = None
    batch_size: int | None = None


class SpendingTargetCreate(BaseModel):
    name: str
    amount: float
    period: str
    categories: list[str]
    start_date: str | None = None


class SavingGoalCreate(BaseModel):
    name: str
    target_amount: float
    current_amount: float = 0
    start_date: str | None = None
    account_id: str | None = None


class AccountUpdate(BaseModel):
    name: str


class RecurringRuleCreate(BaseModel):
    name: str
    type: str = "expense"
    period: str = "monthly"
    category: str | None = None
    statement_match: str | None = None
    amount: float | None = None
    start_date: str | None = None
    active: bool = True


class CategoryRecurringUpdate(BaseModel):
    category: str
    active: bool


class CategoryIncomeUpdate(BaseModel):
    category: str
    active: bool


class DebtCreate(BaseModel):
    name: str
    initial_amount: float
    category: str | None = None
    start_date: str | None = None
    active: bool = True


class DebtPaymentCreate(BaseModel):
    amount: float
    payment_date: str | None = None
    note: str | None = None


class InvestmentCreate(BaseModel):
    name: str
    type: str | None = None
    start_date: str | None = None
    active: bool = True


class InvestmentValueCreate(BaseModel):
    amount: float
    value_date: str | None = None
    note: str | None = None
    source: str = "manual"


class TransactionAllocationCreate(BaseModel):
    from_category: str
    to_category: str
    amount: float
    allocation_date: str | None = None
    note: str | None = None


# ---------------------------
# HEALTH
# ---------------------------

@app.get("/api/hello")
def hello():
    return {
        "message": "FastAPI running",
        "time": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------
# TRANSACTIONS
# ---------------------------

def utc_now_for_akahu():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


@app.post("/api/transactions/load")
def load_transactions(req: LoadTransactionsRequest, user_id: str = Depends(get_user_id)):

    transactions = fetch_in_range(req.start_date, req.end_date or utc_now_for_akahu())
    cleaned = clean_transactions(transactions)
    inserted_ids = set(ingest_transactions(cleaned, user_id))

    return [txn for txn in cleaned if txn["id"] in inserted_ids]


@app.post("/api/transactions/refresh")
def refresh_transactions(user_id: str = Depends(get_user_id)):
    latest_date = get_latest_transaction_date(user_id)

    if not latest_date:
        raise HTTPException(400, "No existing transactions. Choose a start date first.")

    transactions = fetch_in_range(latest_date, utc_now_for_akahu())
    cleaned = clean_transactions(transactions)
    inserted_ids = set(ingest_transactions(cleaned, user_id))

    return {
        "start_date": latest_date,
        "transactions": [txn for txn in cleaned if txn["id"] in inserted_ids],
    }


@app.get("/api/transactions")
def get_transactions(user_id: str = Depends(get_user_id)):
    return get_transactions_from_db(user_id)


@app.post("/api/transactions/classify")
def classify_transactions(
    req: ClassifyTransactionsRequest | None = None,
    user_id: str = Depends(get_user_id),
):
    req = req or ClassifyTransactionsRequest()
    classified = classify_unset_transactions(user_id, req.limit, req.batch_size)
    return {
        "classified": classified,
        "transactions": get_transactions_from_db(user_id),
    }


@app.get("/api/accounts")
def list_accounts(user_id: str = Depends(get_user_id)):
    return get_accounts(user_id)


@app.get("/api/accounts/{account_id}/transactions")
def list_account_transactions(account_id: str, user_id: str = Depends(get_user_id)):
    return get_account_transactions(user_id, account_id)


@app.put("/api/accounts/{account_id}")
def rename_account(account_id: str, update: AccountUpdate, user_id: str = Depends(get_user_id)):
    account = update_account_name(user_id, account_id, update.name)

    if not account:
        raise HTTPException(404, "Account not found")

    return account


@app.put("/api/transactions/{transaction_id}")
def update_transaction(
    transaction_id: str,
    update: TransactionUpdate,
    user_id: str = Depends(get_user_id),
):
    conn = get_connection()
    cursor = conn.cursor()

    updates = []
    params = []

    if update.description is not None:
        updates.append("description = ?")
        params.append(update.description)

    if update.category is None and not updates:
        raise HTTPException(400, "No update provided")

    if updates:
        query = f"""
            UPDATE transactions
            SET {', '.join(updates)}
            WHERE user_id = ?
            AND id = ?
        """

        params.append(user_id)
        params.append(transaction_id)

        cursor.execute(query, params)

        if cursor.rowcount == 0:
            raise HTTPException(404, "Transaction not found")

        conn.commit()
    conn.close()

    if update.category is not None:
        if not set_transaction_category(user_id, transaction_id, update.category, "human", "user"):
            raise HTTPException(404, "Transaction not found")

    return {"message": "updated"}


@app.post("/api/transactions/{transaction_id}/category/accept")
def accept_transaction_classification(transaction_id: str, user_id: str = Depends(get_user_id)):
    if not accept_transaction_category(user_id, transaction_id, "user"):
        raise HTTPException(404, "Suggested category not found")

    return {"message": "accepted"}


@app.post("/api/transactions/category/accept-suggested")
def accept_suggested_transaction_classifications(user_id: str = Depends(get_user_id)):
    accepted_count = accept_all_suggested_transaction_categories(user_id, "user")
    return {
        "accepted": accepted_count,
        "transactions": get_transactions_from_db(user_id),
    }


# ---------------------------
# SUMMARY
# ---------------------------


@app.get("/api/summary/by-category")
def by_category(user_id: str = Depends(get_user_id)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            SUM(-t.amount) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        GROUP BY 1
        HAVING total > 0
        ORDER BY total DESC
    """, (user_id,))

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return apply_allocations_to_category_totals(user_id, rows)


@app.get("/api/summary/by-category/income")
def by_category_income(user_id: str = Depends(get_user_id)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            SUM(t.amount) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
        GROUP BY 1
        HAVING total > 0
        ORDER BY total DESC
    """, (user_id,))

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    total = sum(r["total"] for r in rows)

    for r in rows:
        r["pct"] = round((r["total"] / total) * 100, 1) if total else 0

    return rows


@app.get("/api/spending-targets")
def list_targets(user_id: str = Depends(get_user_id)):
    return get_spending_targets_with_progress(user_id)


@app.post("/api/spending-targets")
def create_target(target: SpendingTargetCreate, user_id: str = Depends(get_user_id)):
    return create_spending_target(
        user_id,
        target.name,
        target.amount,
        target.period,
        target.categories,
        target.start_date,
    )


@app.put("/api/spending-targets/{target_id}")
def update_target(target_id: str, target: SpendingTargetCreate, user_id: str = Depends(get_user_id)):
    updated = update_spending_target(
        user_id,
        target_id,
        target.name,
        target.amount,
        target.period,
        target.categories,
        target.start_date,
    )

    if not updated:
        raise HTTPException(404, "Spending target not found")

    return updated


@app.get("/api/spending-targets/{target_id}/progress")
def target_progress(target_id: str, user_id: str = Depends(get_user_id)):
    return calculate_spending_target_progress(user_id, target_id)


# ---------------------------
# SAVING GOALS
# ---------------------------

@app.get("/api/saving-goals")
def list_goals(user_id: str = Depends(get_user_id)):
    return get_saving_goals(user_id)


@app.post("/api/saving-goals")
def create_goal(goal: SavingGoalCreate, user_id: str = Depends(get_user_id)):
    return create_saving_goal(
        user_id,
        goal.name,
        goal.target_amount,
        goal.current_amount,
        goal.start_date,
        goal.account_id,
    )


@app.put("/api/saving-goals/{goal_id}")
def update_goal(goal_id: str, goal: SavingGoalCreate, user_id: str = Depends(get_user_id)):
    updated = update_saving_goal(
        user_id,
        goal_id,
        goal.name,
        goal.target_amount,
        goal.current_amount,
        goal.start_date,
        goal.account_id,
    )

    if not updated:
        raise HTTPException(404, "Saving goal not found")

    return updated


@app.get("/api/saving-goals/{goal_id}/progress")
def goal_progress(goal_id: str, user_id: str = Depends(get_user_id)):
    return calculate_saving_goal_progress(user_id, goal_id)


@app.get("/api/saving-goals/{goal_id}/account-history")
def goal_account_history(
    goal_id: str,
    period: str = Query("weekly"),
    count: int = Query(8, ge=1, le=260),
    user_id: str = Depends(get_user_id),
):
    if period not in {"weekly", "monthly", "yearly"}:
        raise HTTPException(400, "Period must be weekly, monthly, or yearly")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT account_id
        FROM saving_goals
        WHERE user_id = ?
        AND id = ?
    """, (user_id, goal_id))

    goal = cursor.fetchone()
    conn.close()

    if not goal:
        raise HTTPException(404, "Saving goal not found")

    if not goal["account_id"]:
        return {
            "goal_id": goal_id,
            "account_id": None,
            "period": period,
            "count": count,
            "points": [],
        }

    return {
        "goal_id": goal_id,
        "account_id": goal["account_id"],
        "period": period,
        "count": count,
        "points": get_account_balance_history(user_id, goal["account_id"], period, count),
    }


# ---------------------------
# RECURRING RULES
# ---------------------------

def validate_recurring_rule(rule: RecurringRuleCreate):
    if rule.type not in {"expense", "income"}:
        raise HTTPException(400, "Type must be expense or income")

    if rule.period not in {"weekly", "fortnightly", "monthly", "yearly"}:
        raise HTTPException(400, "Period must be weekly, fortnightly, monthly, or yearly")

    if not (rule.category or rule.statement_match):
        raise HTTPException(400, "Choose a category or statement match")


@app.get("/api/recurring-rules")
def list_recurring_rules(active_only: bool = Query(False), user_id: str = Depends(get_user_id)):
    return get_recurring_rules(user_id, active_only)


@app.post("/api/recurring-rules")
def create_recurring(rule: RecurringRuleCreate, user_id: str = Depends(get_user_id)):
    validate_recurring_rule(rule)
    return create_recurring_rule(
        user_id,
        rule.name,
        rule.type,
        rule.period,
        rule.category,
        rule.statement_match,
        rule.amount,
        rule.start_date,
        rule.active,
    )


@app.put("/api/recurring-rules/{rule_id}")
def update_recurring(rule_id: str, rule: RecurringRuleCreate, user_id: str = Depends(get_user_id)):
    validate_recurring_rule(rule)
    updated = update_recurring_rule(
        user_id,
        rule_id,
        rule.name,
        rule.type,
        rule.period,
        rule.category,
        rule.statement_match,
        rule.amount,
        rule.start_date,
        rule.active,
    )

    if not updated:
        raise HTTPException(404, "Recurring rule not found")

    return updated


@app.delete("/api/recurring-rules/{rule_id}")
def remove_recurring(rule_id: str, user_id: str = Depends(get_user_id)):
    if not delete_recurring_rule(user_id, rule_id):
        raise HTTPException(404, "Recurring rule not found")

    return {"message": "deleted"}


# ---------------------------
# CATEGORIES
# ---------------------------

@app.get("/api/categories")
def list_categories(user_id: str = Depends(get_user_id)):
    return get_categories_with_recurring(user_id)


@app.get("/api/categories/{category}/transactions")
def list_category_transactions(category: str, user_id: str = Depends(get_user_id)):
    return get_category_transactions(user_id, category)


@app.put("/api/categories/recurring")
def update_category_recurring(update: CategoryRecurringUpdate, user_id: str = Depends(get_user_id)):
    category = set_category_recurring(user_id, update.category, update.active)

    if not category:
        raise HTTPException(404, "Category not found")

    return category


@app.put("/api/categories/income")
def update_category_income(update: CategoryIncomeUpdate, user_id: str = Depends(get_user_id)):
    category = set_category_income(user_id, update.category, update.active)

    if not category:
        raise HTTPException(404, "Category not found")

    return category


@app.get("/api/net-worth/projection")
def net_worth_projection(
    period: str = Query("monthly"),
    history_count: int = Query(52, ge=1, le=261),
    future_count: int = Query(52, ge=1, le=261),
    user_id: str = Depends(get_user_id),
):
    if period not in {"weekly", "monthly", "yearly"}:
        raise HTTPException(400, "Period must be weekly, monthly, or yearly")

    return get_net_worth_projection(user_id, period, history_count, future_count)


@app.get("/api/recurring-cashflow/history")
def recurring_cashflow_history(
    period: str = Query("monthly"),
    count: int = Query(12, ge=1, le=60),
    user_id: str = Depends(get_user_id),
):
    if period not in {"weekly", "monthly", "yearly"}:
        raise HTTPException(400, "Period must be weekly, monthly, or yearly")

    return get_recurring_cashflow_history(user_id, period, count)


# ---------------------------
# DEBTS
# ---------------------------

@app.get("/api/debts")
def list_debts(active_only: bool = Query(False), user_id: str = Depends(get_user_id)):
    return get_debts(user_id, active_only)


@app.post("/api/debts")
def create_debt_endpoint(debt: DebtCreate, user_id: str = Depends(get_user_id)):
    return create_debt(
        user_id,
        debt.name,
        debt.initial_amount,
        debt.category,
        debt.start_date,
        debt.active,
    )


@app.put("/api/debts/{debt_id}")
def update_debt_endpoint(debt_id: str, debt: DebtCreate, user_id: str = Depends(get_user_id)):
    updated = update_debt(
        user_id,
        debt_id,
        debt.name,
        debt.initial_amount,
        debt.category,
        debt.start_date,
        debt.active,
    )

    if not updated:
        raise HTTPException(404, "Debt not found")

    return updated


@app.delete("/api/debts/{debt_id}")
def delete_debt_endpoint(debt_id: str, user_id: str = Depends(get_user_id)):
    if not delete_debt(user_id, debt_id):
        raise HTTPException(404, "Debt not found")

    return {"message": "deleted"}


@app.post("/api/debts/{debt_id}/payments")
def create_debt_payment_endpoint(
    debt_id: str,
    payment: DebtPaymentCreate,
    user_id: str = Depends(get_user_id),
):
    debt = create_debt_payment(
        user_id,
        debt_id,
        payment.amount,
        payment.payment_date,
        payment.note,
    )

    if not debt:
        raise HTTPException(404, "Debt not found")

    return debt


@app.delete("/api/debts/{debt_id}/payments/{payment_id}")
def delete_debt_payment_endpoint(
    debt_id: str,
    payment_id: str,
    user_id: str = Depends(get_user_id),
):
    if not delete_debt_payment(user_id, debt_id, payment_id):
        raise HTTPException(404, "Debt payment not found")

    debt = get_debts(user_id)
    return {"message": "deleted", "debts": debt}


# ---------------------------
# INVESTMENTS
# ---------------------------

@app.get("/api/investments")
def list_investments(active_only: bool = Query(False), user_id: str = Depends(get_user_id)):
    return get_investments(user_id, active_only)


@app.post("/api/investments")
def create_investment_endpoint(investment: InvestmentCreate, user_id: str = Depends(get_user_id)):
    return create_investment(
        user_id,
        investment.name,
        investment.type,
        investment.start_date,
        investment.active,
    )


@app.put("/api/investments/{investment_id}")
def update_investment_endpoint(
    investment_id: str,
    investment: InvestmentCreate,
    user_id: str = Depends(get_user_id),
):
    updated = update_investment(
        user_id,
        investment_id,
        investment.name,
        investment.type,
        investment.start_date,
        investment.active,
    )

    if not updated:
        raise HTTPException(404, "Investment not found")

    return updated


@app.delete("/api/investments/{investment_id}")
def delete_investment_endpoint(investment_id: str, user_id: str = Depends(get_user_id)):
    if not delete_investment(user_id, investment_id):
        raise HTTPException(404, "Investment not found")

    return {"message": "deleted"}


@app.post("/api/investments/{investment_id}/values")
def create_investment_value_endpoint(
    investment_id: str,
    value: InvestmentValueCreate,
    user_id: str = Depends(get_user_id),
):
    investment = create_investment_value(
        user_id,
        investment_id,
        value.amount,
        value.value_date,
        value.note,
        value.source,
    )

    if not investment:
        raise HTTPException(404, "Investment not found")

    return investment


@app.delete("/api/investments/{investment_id}/values/{value_id}")
def delete_investment_value_endpoint(
    investment_id: str,
    value_id: str,
    user_id: str = Depends(get_user_id),
):
    if not delete_investment_value(user_id, investment_id, value_id):
        raise HTTPException(404, "Investment value not found")

    investments = get_investments(user_id)
    return {"message": "deleted", "investments": investments}


# ---------------------------
# ALLOCATIONS
# ---------------------------

@app.get("/api/allocations")
def list_allocations(user_id: str = Depends(get_user_id)):
    return get_category_allocations(user_id)


@app.post("/api/allocations")
def create_allocation(allocation: TransactionAllocationCreate, user_id: str = Depends(get_user_id)):
    created = create_category_allocation(
        user_id,
        allocation.from_category,
        allocation.to_category,
        allocation.amount,
        allocation.allocation_date,
        allocation.note,
    )

    if not created:
        raise HTTPException(400, "Could not create allocation")

    return created


@app.delete("/api/allocations/{allocation_id}")
def delete_allocation(allocation_id: str, user_id: str = Depends(get_user_id)):
    if not delete_category_allocation(user_id, allocation_id):
        raise HTTPException(404, "Allocation not found")

    return {"message": "deleted"}


@app.get("/api/summary")
def summary(
    start_date: str = None,
    end_date: str = None,
    user_id: str = Depends(get_user_id),
):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            SUM(-t.amount) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
    """

    params = [user_id]

    if start_date:
        query += " AND t.date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND t.date <= ?"
        params.append(end_date)

    query += " GROUP BY 1 HAVING total > 0 ORDER BY total DESC"

    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return apply_allocations_to_category_totals(user_id, rows, start_date, end_date)


@app.get("/api/dashboard")
def dashboard(
    start_date: str = Query(None),
    end_date: str = Query(None),
    user_id: str = Depends(get_user_id),
):
    conn = get_connection()
    cursor = conn.cursor()

    # ---------------------------
    # SUMMARY (expenses)
    # ---------------------------
    query = """
        SELECT
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            SUM(-t.amount) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
    """

    params = [user_id]

    if start_date:
        query += " AND t.date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND t.date <= ?"
        params.append(end_date)

    query += " GROUP BY 1 HAVING total > 0 ORDER BY total DESC"

    cursor.execute(query, params)
    summary = apply_allocations_to_category_totals(
        user_id,
        [dict(r) for r in cursor.fetchall()],
        start_date,
        end_date,
    )

    # ---------------------------
    # INCOME SUMMARY
    # ---------------------------
    income_query = """
        SELECT
            COALESCE(NULLIF(c.category, ''), NULLIF(t.category, ''), 'Uncategorised') AS category,
            SUM(t.amount) AS total
        FROM transactions t
        LEFT JOIN transaction_classifications c
            ON c.user_id = t.user_id
            AND c.transaction_id = t.id
        WHERE t.user_id = ?
    """
    income_params = [user_id]

    if start_date:
        income_query += " AND t.date >= ?"
        income_params.append(start_date)

    if end_date:
        income_query += " AND t.date <= ?"
        income_params.append(end_date)

    income_query += " GROUP BY 1 HAVING total > 0 ORDER BY total DESC"

    cursor.execute(income_query, income_params)

    income_summary = [dict(r) for r in cursor.fetchall()]

    total_income = sum(r["total"] for r in income_summary)

    for r in income_summary:
        r["pct"] = round((r["total"] / total_income) * 100, 1) if total_income else 0

    conn.close()

    # ---------------------------
    # ENRICHED DATA
    # ---------------------------
    spending_targets = get_spending_targets_with_progress(user_id)
    saving_goals = get_saving_goals(user_id)
    recurring_rules = get_recurring_rules(user_id)
    recurring_expense_categories = [
        category["category"]
        for category in get_categories_with_recurring(user_id)
        if category.get("is_recurring")
    ]

    return {
        "summary": summary,
        "income_summary": income_summary,
        "spending_targets": spending_targets,
        "saving_goals": saving_goals,
        "recurring_rules": recurring_rules,
        "recurring_expense_categories": recurring_expense_categories,
        "date_range": {
            "start_date": start_date,
            "end_date": end_date,
        }
    }
