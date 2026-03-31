import { useState, useEffect, useRef } from "react";

const CURRENCY = "﷼";

const INCOME_CATEGORIES = [
"Primary Salary", "Freelance / Side", "Rental Income",
"Investment Returns", "Bonus / Commission", "Other Income"
];

const EXPENSE_SECTIONS = {
"🏠 Housing":      ["Rent / Mortgage","Electricity","Water","Internet","Maintenance"],
"🚗 Transport":    ["Car Payment","Fuel","Parking / Tolls","Uber / Taxi"],
"🛒 Food":         ["Groceries","Dining Out","Work Meals"],
"💊 Health":       ["Health Insurance","Pharmacy","Doctor Visits"],
"📱 Subscriptions":["Mobile Plan","Netflix / Streaming","Cloud / Software"],
"👨‍👩‍👧 Family":       ["School Fees","Child Care","Family Transfers"],
"🎯 Personal":     ["Clothing","Personal Care","Gym / Sports"],
"🎓 Education":    ["Books / Courses","Master's Fees","Research Materials"],
"💰 Savings":      ["Emergency Fund","Investments","BNPL Reserve"],
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const now = new Date();

function fmt(n) {
if (!n && n !== 0) return `${CURRENCY}0`;
return `${CURRENCY}${Number(n).toLocaleString("en-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function buildInitial() {
const income = {};
INCOME_CATEGORIES.forEach(c => { income[c] = { budgeted: 0, actual: 0 }; });
const expenses = {};
Object.entries(EXPENSE_SECTIONS).forEach(([sec, items]) => {
items.forEach(item => { expenses[item] = { budgeted: 0, actual: 0, section: sec }; });
});
return { income, expenses };
}

const STORAGE_KEY = "rabt_budget_v1";

function loadData() {
try {
const raw = window.localStorage?.getItem?.(STORAGE_KEY);
if (raw) return JSON.parse(raw);
} catch {}
return null;
}

function saveData(data) {
try { window.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

const TABS = ["📊 Dashboard", "📥 Income", "💸 Expenses", "📅 Log"];

export default function BudgetApp() {
const initial = buildInitial();
const saved = loadData();
const [tab, setTab] = useState(0);
const [month, setMonth] = useState(now.getMonth());
const [income, setIncome] = useState(saved?.income || initial.income);
const [expenses, setExpenses] = useState(saved?.expenses || initial.expenses);
const [log, setLog] = useState(saved?.log || []);
const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0,10), desc: "", amount: "", type: "Expense", cat: "" });
const [pulse, setPulse] = useState(null);

useEffect(() => { saveData({ income, expenses, log }); }, [income, expenses, log]);

const totalIncomeBudget = Object.values(income).reduce((s,v) => s + (Number(v.budgeted)||0), 0);
const totalIncomeActual = Object.values(income).reduce((s,v) => s + (Number(v.actual)||0), 0);
const totalExpBudget    = Object.values(expenses).reduce((s,v) => s + (Number(v.budgeted)||0), 0);
const totalExpActual    = Object.values(expenses).reduce((s,v) => s + (Number(v.actual)||0), 0);
const netBudget = totalIncomeBudget - totalExpBudget;
const netActual = totalIncomeActual - totalExpActual;
const savingsRate = totalIncomeActual > 0 ? ((netActual / totalIncomeActual) * 100).toFixed(1) : 0;

function updateIncome(cat, field, val) {
setIncome(p => ({ ...p, [cat]: { ...p[cat], [field]: val === "" ? "" : Number(val) } }));
}
function updateExp(item, field, val) {
setExpenses(p => ({ ...p, [item]: { ...p[item], [field]: val === "" ? "" : Number(val) } }));
}

function addLog() {
if (!logForm.desc || !logForm.amount) return;
const entry = { ...logForm, id: Date.now(), amount: Number(logForm.amount) };
setLog(p => [entry, ...p]);
// reflect in actual
const amt = entry.amount;
if (entry.type === "Income") {
const match = INCOME_CATEGORIES.find(c => c === entry.cat);
if (match) updateIncome(match, "actual", (Number(income[match]?.actual)||0) + amt);
} else {
if (expenses[entry.cat]) updateExp(entry.cat, "actual", (Number(expenses[entry.cat]?.actual)||0) + amt);
}
setPulse(entry.id);
setLogForm(p => ({ ...p, desc: "", amount: "", cat: "" }));
}

function deleteLog(id) { setLog(p => p.filter(e => e.id !== id)); }

function reset() {
if (!confirm("Reset all data for this month?")) return;
const i = buildInitial();
setIncome(i.income); setExpenses(i.expenses); setLog([]);
}

const pct = (a, b) => b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
const health = netActual >= 0 ? (savingsRate >= 20 ? "🟢 Healthy" : savingsRate >= 5 ? "🟡 Okay" : "🟠 Watch Out") : "🔴 Over Budget";

// Section totals for expenses
const sectionTotals = {};
Object.entries(EXPENSE_SECTIONS).forEach(([sec, items]) => {
sectionTotals[sec] = { budgeted: 0, actual: 0 };
items.forEach(item => {
sectionTotals[sec].budgeted += Number(expenses[item]?.budgeted)||0;
sectionTotals[sec].actual   += Number(expenses[item]?.actual)||0;
});
});

return (
<div style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif", background: "#0F1923", minHeight: "100vh", color: "#E8EDF2" }}>
{/* Header */}
<div style={{ background: "linear-gradient(135deg,#0F3460 0%,#162447 100%)", padding: "20px 24px 0", borderBottom: "1px solid #1E3A5F" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
<div>
<div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, color: "#fff" }}>💰 Budget Tracker</div>
<div style={{ fontSize: 12, color: "#7FA6C9" }}>{MONTH_NAMES[month]} {now.getFullYear()} · Saudi Riyal (﷼)</div>
</div>
<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
<select value={month} onChange={e => setMonth(Number(e.target.value))}
style={{ background: "#1E3A5F", color: "#fff", border: "1px solid #2D5F8A", borderRadius: 6, padding: "4px 10px", fontSize: 12 }}>
{MONTHS.map((m,i) => <option key={m} value={i}>{m}</option>)}
</select>
<button onClick={reset} style={{ background: "#8B1A1A", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>↺ Reset</button>
</div>
</div>
{/* Tabs */}
<div style={{ display: "flex", gap: 4 }}>
{TABS.map((t,i) => (
<button key={t} onClick={() => setTab(i)} style={{
padding: "8px 16px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
background: tab === i ? "#0F1923" : "transparent", color: tab === i ? "#2ECC71" : "#7FA6C9",
borderBottom: tab === i ? "2px solid #2ECC71" : "2px solid transparent", transition: "all 0.2s"
}}>{t}</button>
))}
</div>
</div>

  <div style={{ padding: "20px 24px", maxWidth: 900, margin: "0 auto" }}>

    {/* ── DASHBOARD ── */}
    {tab === 0 && (
      <div>
        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Income", val: fmt(totalIncomeActual), sub: `Budgeted: ${fmt(totalIncomeBudget)}`, color: "#3498DB", icon: "📈" },
            { label: "Total Expenses", val: fmt(totalExpActual), sub: `Budgeted: ${fmt(totalExpBudget)}`, color: "#E74C3C", icon: "📉" },
            { label: "Net Savings", val: fmt(netActual), sub: `Budgeted: ${fmt(netBudget)}`, color: netActual >= 0 ? "#2ECC71" : "#E74C3C", icon: "💎" },
            { label: "Savings Rate", val: `${savingsRate}%`, sub: health, color: "#F39C12", icon: "🎯" },
          ].map(card => (
            <div key={card.label} style={{ background: "#162447", borderRadius: 12, padding: "14px 16px", borderLeft: `4px solid ${card.color}` }}>
              <div style={{ fontSize: 20 }}>{card.icon}</div>
              <div style={{ fontSize: 11, color: "#7FA6C9", marginTop: 4 }}>{card.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: card.color, margin: "4px 0" }}>{card.val}</div>
              <div style={{ fontSize: 10, color: "#5A7A95" }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Budget Health Bar */}
        <div style={{ background: "#162447", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Expense Usage</span>
            <span style={{ fontSize: 12, color: "#7FA6C9" }}>{fmt(totalExpActual)} / {fmt(totalExpBudget)}</span>
          </div>
          <div style={{ background: "#0F1923", borderRadius: 20, height: 12, overflow: "hidden" }}>
            <div style={{
              width: `${pct(totalExpActual, totalExpBudget)}%`, height: "100%", borderRadius: 20,
              background: pct(totalExpActual, totalExpBudget) > 90 ? "#E74C3C" : pct(totalExpActual, totalExpBudget) > 70 ? "#F39C12" : "#2ECC71",
              transition: "width 0.6s ease"
            }}/>
          </div>
          <div style={{ fontSize: 11, color: "#7FA6C9", marginTop: 6 }}>{pct(totalExpActual, totalExpBudget)}% of budget used</div>
        </div>

        {/* Section breakdown */}
        <div style={{ background: "#162447", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 Spending by Category</div>
          {Object.entries(sectionTotals).map(([sec, { budgeted, actual }]) => (
            <div key={sec} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span>{sec}</span>
                <span style={{ color: actual > budgeted && budgeted > 0 ? "#E74C3C" : "#7FA6C9" }}>{fmt(actual)} / {fmt(budgeted)}</span>
              </div>
              <div style={{ background: "#0F1923", borderRadius: 20, height: 6 }}>
                <div style={{
                  width: `${pct(actual, budgeted)}%`, height: "100%", borderRadius: 20,
                  background: pct(actual, budgeted) > 90 ? "#E74C3C" : "#3498DB", transition: "width 0.5s"
                }}/>
              </div>
            </div>
          ))}
        </div>

        {/* 50/30/20 rule */}
        <div style={{ background: "#162447", borderRadius: 12, padding: 14, marginTop: 16, borderLeft: "4px solid #F39C12" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#F39C12", marginBottom: 6 }}>💡 50/30/20 Rule Guide</div>
          {[
            { label: "50% Needs (Housing/Bills)", target: totalIncomeActual * 0.5, color: "#3498DB" },
            { label: "30% Wants (Food/Lifestyle)", target: totalIncomeActual * 0.3, color: "#9B59B6" },
            { label: "20% Savings", target: totalIncomeActual * 0.2, color: "#2ECC71" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", borderBottom: "1px solid #1E3A5F" }}>
              <span style={{ color: "#7FA6C9" }}>{r.label}</span>
              <span style={{ color: r.color, fontWeight: 700 }}>{fmt(r.target)}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* ── INCOME ── */}
    {tab === 1 && (
      <div>
        <div style={{ background: "#162447", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: "#1A4A7A", padding: "10px 16px", display: "grid", gridTemplateColumns: "1fr 120px 120px 90px", gap: 8, fontSize: 11, fontWeight: 700, color: "#7FA6C9" }}>
            <span>Source</span><span style={{ textAlign: "center" }}>Budgeted ﷼</span><span style={{ textAlign: "center" }}>Actual ﷼</span><span style={{ textAlign: "center" }}>% Hit</span>
          </div>
          {INCOME_CATEGORIES.map((cat, i) => (
            <div key={cat} style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 90px", gap: 8, padding: "10px 16px", background: i % 2 === 0 ? "#0F1923" : "#162447", alignItems: "center", borderBottom: "1px solid #1E3A5F" }}>
              <span style={{ fontSize: 13 }}>{cat}</span>
              <input type="number" min="0" value={income[cat]?.budgeted ?? ""} onChange={e => updateIncome(cat, "budgeted", e.target.value)}
                style={{ background: "#0A2540", border: "1px solid #2D5F8A", borderRadius: 6, color: "#64B5F6", padding: "5px 8px", textAlign: "right", fontSize: 12, width: "100%", boxSizing: "border-box" }} />
              <input type="number" min="0" value={income[cat]?.actual ?? ""} onChange={e => updateIncome(cat, "actual", e.target.value)}
                style={{ background: "#0A2540", border: "1px solid #2D5F8A", borderRadius: 6, color: "#2ECC71", padding: "5px 8px", textAlign: "right", fontSize: 12, width: "100%", boxSizing: "border-box" }} />
              <div style={{ textAlign: "center", fontSize: 12, color: pct(income[cat]?.actual||0, income[cat]?.budgeted||0) >= 100 ? "#2ECC71" : "#F39C12", fontWeight: 700 }}>
                {income[cat]?.budgeted > 0 ? `${pct(income[cat]?.actual||0, income[cat]?.budgeted||0)}%` : "--"}
              </div>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 90px", gap: 8, padding: "12px 16px", background: "#0D2137", borderTop: "2px solid #3498DB" }}>
            <span style={{ fontWeight: 800, color: "#3498DB", fontSize: 13 }}>TOTAL</span>
            <span style={{ textAlign: "center", color: "#3498DB", fontWeight: 700, fontSize: 13 }}>{fmt(totalIncomeBudget)}</span>
            <span style={{ textAlign: "center", color: "#2ECC71", fontWeight: 700, fontSize: 13 }}>{fmt(totalIncomeActual)}</span>
            <span style={{ textAlign: "center", color: "#F39C12", fontWeight: 700, fontSize: 12 }}>{totalIncomeBudget > 0 ? `${pct(totalIncomeActual, totalIncomeBudget)}%` : "--"}</span>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#5A7A95", marginTop: 8 }}>🔵 Blue = Budgeted amount · 🟢 Green = Actual amount received</div>
      </div>
    )}

    {/* ── EXPENSES ── */}
    {tab === 2 && (
      <div>
        {Object.entries(EXPENSE_SECTIONS).map(([sec, items]) => (
          <div key={sec} style={{ background: "#162447", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ background: "#0F3460", padding: "8px 16px", display: "grid", gridTemplateColumns: "1fr 110px 110px 80px", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{sec}</span>
              <span style={{ fontSize: 10, color: "#7FA6C9", textAlign: "center" }}>Budgeted</span>
              <span style={{ fontSize: 10, color: "#7FA6C9", textAlign: "center" }}>Actual</span>
              <span style={{ fontSize: 10, color: "#7FA6C9", textAlign: "center" }}>% Used</span>
            </div>
            {items.map((item, i) => (
              <div key={item} style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 80px", gap: 8, padding: "8px 16px", background: i % 2 === 0 ? "#0F1923" : "#162447", alignItems: "center", borderBottom: "1px solid #1E3A5F" }}>
                <span style={{ fontSize: 12, color: "#B0C4D8" }}>{item}</span>
                <input type="number" min="0" value={expenses[item]?.budgeted ?? ""} onChange={e => updateExp(item, "budgeted", e.target.value)}
                  style={{ background: "#0A2540", border: "1px solid #2D5F8A", borderRadius: 6, color: "#64B5F6", padding: "4px 6px", textAlign: "right", fontSize: 11, width: "100%", boxSizing: "border-box" }} />
                <input type="number" min="0" value={expenses[item]?.actual ?? ""} onChange={e => updateExp(item, "actual", e.target.value)}
                  style={{ background: "#0A2540", border: "1px solid #2D5F8A", borderRadius: 6, color: pct(expenses[item]?.actual||0, expenses[item]?.budgeted||0) > 90 ? "#E74C3C" : "#2ECC71", padding: "4px 6px", textAlign: "right", fontSize: 11, width: "100%", boxSizing: "border-box" }} />
                <div style={{ textAlign: "center" }}>
                  {expenses[item]?.budgeted > 0 ? (
                    <div style={{ background: "#0F1923", borderRadius: 10, height: 6, overflow: "hidden" }}>
                      <div style={{ width: `${pct(expenses[item]?.actual||0, expenses[item]?.budgeted||0)}%`, height: "100%", background: pct(expenses[item]?.actual||0, expenses[item]?.budgeted||0) > 90 ? "#E74C3C" : "#2ECC71", borderRadius: 10 }}/>
                    </div>
                  ) : <span style={{ color: "#5A7A95", fontSize: 10 }}>--</span>}
                </div>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 80px", gap: 8, padding: "8px 16px", background: "#0D2137" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#E74C3C" }}>Section Total</span>
              <span style={{ textAlign: "center", color: "#7FA6C9", fontSize: 11 }}>{fmt(sectionTotals[sec]?.budgeted)}</span>
              <span style={{ textAlign: "center", color: "#E74C3C", fontWeight: 700, fontSize: 11 }}>{fmt(sectionTotals[sec]?.actual)}</span>
              <span />
            </div>
          </div>
        ))}
        <div style={{ background: "#0D2137", borderRadius: 12, padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 110px 110px 80px", gap: 8, border: "2px solid #E74C3C" }}>
          <span style={{ fontWeight: 800, color: "#E74C3C", fontSize: 14 }}>TOTAL EXPENSES</span>
          <span style={{ textAlign: "center", color: "#7FA6C9", fontWeight: 700 }}>{fmt(totalExpBudget)}</span>
          <span style={{ textAlign: "center", color: "#E74C3C", fontWeight: 800, fontSize: 14 }}>{fmt(totalExpActual)}</span>
          <span />
        </div>
      </div>
    )}

    {/* ── LOG ── */}
    {tab === 3 && (
      <div>
        {/* Add transaction */}
        <div style={{ background: "#162447", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#2ECC71" }}>+ Add Transaction</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: "#7FA6C9", marginBottom: 4 }}>Date</div>
              <input type="date" value={logForm.date} onChange={e => setLogForm(p => ({ ...p, date: e.target.value }))}
                style={{ width: "100%", background: "#0A2540", border: "1px solid #2D5F8A", borderRadius: 6, color: "#fff", padding: "7px 10px", fontSize: 12, boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#7FA6C9", marginBottom: 4 }}>Type</div>
              <select value={logForm.type} onChange={e => setLogForm(p => ({ ...p, type: e.target.value, cat: "" }))}
                style={{ width: "100%", background: "#0A2540", border: "1px solid #2D5F8A", borderRadius: 6, color: "#fff", padding: "7px 10px", fontSize: 12, boxSizing: "border-box" }}>
                <option>Income</option><option>Expense</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "#7FA6C9", marginBottom: 4 }}>Description</div>
            <input placeholder="e.g. Danube groceries" value={logForm.desc} onChange={e => setLogForm(p => ({ ...p, desc: e.target.value }))}
              style={{ width: "100%", background: "#0A2540", border: "1px solid #2D5F8A", borderRadius: 6, color: "#fff", padding: "7px 10px", fontSize: 12, boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#7FA6C9", marginBottom: 4 }}>Amount (﷼)</div>
              <input type="number" min="0" placeholder="0" value={logForm.amount} onChange={e => setLogForm(p => ({ ...p, amount: e.target.value }))}
                style={{ width: "100%", background: "#0A2540", border: "1px solid #2D5F8A", borderRadius: 6, color: "#2ECC71", padding: "7px 10px", fontSize: 12, boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#7FA6C9", marginBottom: 4 }}>Category</div>
              <select value={logForm.cat} onChange={e => setLogForm(p => ({ ...p, cat: e.target.value }))}
                style={{ width: "100%", background: "#0A2540", border: "1px solid #2D5F8A", borderRadius: 6, color: "#fff", padding: "7px 10px", fontSize: 12, boxSizing: "border-box" }}>
                <option value="">Select...</option>
                {logForm.type === "Income"
                  ? INCOME_CATEGORIES.map(c => <option key={c}>{c}</option>)
                  : Object.entries(EXPENSE_SECTIONS).map(([sec, items]) => (
                      <optgroup key={sec} label={sec}>
                        {items.map(i => <option key={i}>{i}</option>)}
                      </optgroup>
                    ))
                }
              </select>
            </div>
          </div>
          <button onClick={addLog} style={{ width: "100%", background: "#2ECC71", color: "#0F1923", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
            ＋ Add Entry
          </button>
        </div>

        {/* Log list */}
        <div style={{ background: "#162447", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: "#0F3460", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#7FA6C9", display: "flex", justifyContent: "space-between" }}>
            <span>Transactions ({log.length})</span>
            <span>Total logged: {fmt(log.reduce((s, e) => e.type === "Expense" ? s + e.amount : s, 0))} expenses</span>
          </div>
          {log.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "#5A7A95", fontSize: 13 }}>No transactions yet. Add your first one above! 👆</div>
          )}
          {log.map((entry, i) => (
            <div key={entry.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 16px", background: i % 2 === 0 ? "#0F1923" : "#162447",
              borderBottom: "1px solid #1E3A5F", animation: pulse === entry.id ? "fadeIn 0.4s ease" : undefined
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#E8EDF2" }}>{entry.desc}</div>
                <div style={{ fontSize: 10, color: "#5A7A95" }}>{entry.date} · {entry.cat}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: entry.type === "Income" ? "#2ECC71" : "#E74C3C" }}>
                  {entry.type === "Income" ? "+" : "-"}{fmt(entry.amount)}
                </span>
                <button onClick={() => deleteLog(entry.id)} style={{ background: "none", border: "none", color: "#5A7A95", cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>

  <style>{`
    input:focus, select:focus { outline: 1px solid #2ECC71 !important; }
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0F1923; } ::-webkit-scrollbar-thumb { background: #2D5F8A; border-radius: 4px; }
  `}</style>
</div>

);
}
