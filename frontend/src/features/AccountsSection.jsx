import { useEffect, useState } from "react";

import { API } from "@/api/constants";
import SectionShell from "@/components/SectionShell";
import DebtsSection from "@/features/debts/DebtsSection";
import useDebts from "@/features/debts/useDebts";
import InvestmentsSection from "@/features/investments/InvestmentsSection";
import useInvestments from "@/features/investments/useInvestments";

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function AccountTile({ account, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(account.name || account.id);
  const [saving, setSaving] = useState(false);

  const cancelEdit = () => {
    setDraftName(account.name || account.id);
    setEditing(false);
  };

  const saveName = async () => {
    const nextName = draftName.trim();
    const currentName = account.name || account.id;

    if (!nextName || nextName === currentName) {
      setDraftName(currentName);
      setEditing(false);
      return;
    }

    try {
      setSaving(true);
      await onRename(account.id, nextName);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--border2)",
        background: "var(--surface2)",
        borderRadius: 6,
        padding: "15px 16px",
        minWidth: 0,
      }}
    >
      {editing ? (
        <input
          autoFocus
          value={draftName}
          disabled={saving}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              cancelEdit();
            }
          }}
          style={{
            width: "100%",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
            background: "var(--surface)",
            border: "1px solid var(--accent)",
            borderRadius: 3,
            padding: "4px 6px",
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraftName(account.name || account.id);
            setEditing(true);
          }}
          title={account.source_name && account.source_name !== account.name ? `Original: ${account.source_name}` : "Rename account"}
          style={{
            display: "block",
            width: "100%",
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "text",
            textAlign: "left",
          }}
        >
          {saving ? "Saving..." : account.name || account.id}
        </button>
      )}
      <div
        style={{
          color: "var(--accent)",
          fontFamily: "var(--font-display)",
          fontSize: 34,
          lineHeight: 1,
        }}
      >
        {formatMoney(account.latest_balance)}
      </div>
      <div
        style={{
          color: "var(--muted)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          marginTop: 8,
        }}
      >
        {account.latest_date ? account.latest_date.slice(0, 10) : "No balance yet"}
      </div>
    </div>
  );
}

export default function AccountsSection() {
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [debtCreateRequest, setDebtCreateRequest] = useState(0);
  const [investmentCreateRequest, setInvestmentCreateRequest] = useState(0);
  const { debts } = useDebts();
  const { investments } = useInvestments();

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      try {
        setAccountsLoading(true);
        const res = await fetch(`${API}/api/accounts`);
        if (!res.ok) throw new Error("Failed to load accounts");
        const data = await res.json();
        if (!cancelled) setAccounts(data || []);
      } catch (err) {
        console.error("Failed loading accounts:", err);
        if (!cancelled) setAccounts([]);
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    }

    loadAccounts();

    return () => {
      cancelled = true;
    };
  }, []);

  const accountTotal = accounts.reduce(
    (sum, account) => sum + Number(account.latest_balance || 0),
    0
  );
  const activeDebts = debts.filter((debt) => debt.active);
  const debtRemaining = debts.reduce(
    (sum, debt) => sum + Number(debt.remaining_amount || 0),
    0
  );
  const activeInvestments = investments.filter((investment) => investment.active);
  const investmentTotal = activeInvestments.reduce(
    (sum, investment) => sum + Number(investment.latest_value || 0),
    0
  );

  const renameAccount = async (accountId, name) => {
    try {
      const res = await fetch(`${API}/api/accounts/${encodeURIComponent(accountId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) throw new Error(await res.text() || "Failed to rename account");

      const updated = await res.json();
      setAccounts((prev) =>
        prev.map((account) =>
          account.id === accountId
            ? { ...account, name: updated.name || name }
            : account
        )
      );
    } catch (err) {
      alert(err.message);
      throw err;
    }
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <SectionShell
        title="Accounts"
        description="Connected bank balances"
        summary={[
          { label: "Connected", value: accountsLoading ? "-" : accounts.length },
          { label: "Balance", value: accountsLoading ? "-" : formatMoney(accountTotal), tone: "accent" },
        ]}
      >
        {accountsLoading ? (
          <div style={{ color: "var(--muted2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            Loading accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div style={{ color: "var(--muted2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            No account balances detected yet. Load new Akahu transactions to capture account IDs.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {accounts.map((account) => (
              <AccountTile
                key={account.id}
                account={account}
                onRename={renameAccount}
              />
            ))}
          </div>
        )}
      </SectionShell>

      <SectionShell
        title="Debts"
        description="Paydown progress and manual payments"
        defaultExpanded={false}
        summary={[
          { label: "Active", value: activeDebts.length },
          { label: "Remaining", value: formatMoney(debtRemaining), tone: debtRemaining > 0 ? "bad" : "good" },
        ]}
        action={
          <button
            type="button"
            onClick={() => setDebtCreateRequest((value) => value + 1)}
            style={{
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 4,
              padding: "8px 11px",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Add
          </button>
        }
      >
        <DebtsSection
          transactions={[]}
          embedded
          createRequest={debtCreateRequest}
        />
      </SectionShell>

      <SectionShell
        title="Investments"
        description="Tracked assets and manual value updates"
        defaultExpanded={false}
        summary={[
          { label: "Active", value: activeInvestments.length },
          { label: "Value", value: formatMoney(investmentTotal), tone: "good" },
        ]}
        action={
          <button
            type="button"
            onClick={() => setInvestmentCreateRequest((value) => value + 1)}
            style={{
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 4,
              padding: "8px 11px",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Add
          </button>
        }
      >
        <InvestmentsSection
          embedded
          createRequest={investmentCreateRequest}
        />
      </SectionShell>
    </div>
  );
}
