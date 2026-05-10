import { useEffect, useState } from "react";

import { API } from "@/api/constants";
import SectionShell from "@/components/SectionShell";
import DebtsSection from "@/features/debts/DebtsSection";
import useDebts from "@/features/debts/useDebts";

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function AccountTile({ account }) {
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
      <div
        style={{
          color: "var(--muted2)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 10,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {account.name || account.id}
      </div>
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
  const { debts } = useDebts();

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
              <AccountTile key={account.id} account={account} />
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
      >
        <DebtsSection transactions={[]} />
      </SectionShell>

      <SectionShell
        title="Investments"
        description="Placeholder for future tracked assets"
        defaultExpanded={false}
        summary={[
          { label: "Status", value: "Planned" },
          { label: "Data", value: "Not connected" },
        ]}
      >
        <div
          style={{
            border: "1px dashed var(--border2)",
            background: "var(--surface2)",
            borderRadius: 6,
            padding: 18,
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          Investment tracking can use this same compact account pattern once backend data exists.
        </div>
      </SectionShell>
    </div>
  );
}
