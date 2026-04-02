import { useState, useEffect } from "react";

const CURRENCY = "﷼";

const INCOME_CATEGORIES = [
  "Primary Salary", "Freelance / Side", "Rental Income",
  "Investment Returns", "Bonus / Commission", "Other Income"
];

const EXPENSE_SECTIONS = {
  "🏠 Housing":       ["Rent / Mortgage","Electricity","Water","Internet","Maintenance"],
  "🚗 Transport":     ["Car Payment","Fuel","Parking / Tolls","Uber / Taxi"],
  "🛒 Food":          ["Groceries","Dining Out","Work Meals"],
  "💊 Health":        ["Health Insurance","Pharmacy","Doctor Visits"],
  "📱 Subscriptions": ["Mobile Plan","Netflix / Streaming","Cloud / Software"],
  "👨‍👩‍👧 Family":        ["School Fees","Child Care","Family Transfers"],
  "🎯 Personal":      ["Clothing","Personal Care","Gym / Sports"],
  "🎓 Education":     ["Books / Courses","Master's Fees","Research Materials"],
  "💰 Savings":       ["Emergency Fund","Investments","BNPL Reserve"],
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const now = new Date();

const SECTION_ICONS = {
  "🏠 Housing": "home",
  "🚗 Transport": "directions_car",
  "🛒 Food": "shopping_cart",
  "💊 Health": "favorite",
  "📱 Subscriptions": "subscriptions",
  "👨‍👩‍👧 Family": "family_restroom",
  "🎯 Personal": "self_improvement",
  "🎓 Education": "school",
  "💰 Savings": "savings",
};

const INCOME_ICONS = {
  "Primary Salary": "work",
  "Freelance / Side": "laptop",
  "Rental Income": "home_work",
  "Investment Returns": "trending_up",
  "Bonus / Commission": "star",
  "Other Income": "add_circle",
};

const NAV_ITEMS = [
  { label: "Dashboard", icon: "grid_view" },
  { label: "Income",    icon: "payments" },
  { label: "Expenses",  icon: "account_balance_wallet" },
  { label: "Log",       icon: "receipt_long" },
];

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
  const health = netActual >= 0 ? (savingsRate >= 20 ? "Healthy" : savingsRate >= 5 ? "Okay" : "Watch Out") : "Over Budget";
  const healthColorCls = health === "Healthy" ? "text-emerald-400" : health === "Okay" ? "text-yellow-400" : health === "Watch Out" ? "text-orange-400" : "text-error";

  const sectionTotals = {};
  Object.entries(EXPENSE_SECTIONS).forEach(([sec, items]) => {
    sectionTotals[sec] = { budgeted: 0, actual: 0 };
    items.forEach(item => {
      sectionTotals[sec].budgeted += Number(expenses[item]?.budgeted)||0;
      sectionTotals[sec].actual   += Number(expenses[item]?.actual)||0;
    });
  });

  const inputCls = "w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all";

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-tertiary/10 blur-[100px] rounded-full -z-10 pointer-events-none" />

      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 z-[60] bg-slate-950/70 backdrop-blur-2xl shadow-[10px_0px_30px_rgba(0,0,0,0.5)] p-6">
        <div className="text-xl font-black text-primary mb-8 font-headline tracking-tight">💰 Budget Planner</div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item, i) => (
            <button key={item.label} onClick={() => setTab(i)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 ${
                tab === i
                  ? "bg-gradient-to-r from-cyan-500/20 to-transparent text-primary border-r-4 border-primary"
                  : "text-on-surface-variant hover:bg-white/10 hover:text-on-surface"
              }`}>
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button onClick={() => setTab(3)}
          className="mt-auto w-full py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm">add</span>
          Add Transaction
        </button>
      </aside>

      {/* Main */}
      <main className="md:ml-64 min-h-screen pb-20 md:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-slate-950/60 backdrop-blur-xl shadow-[0px_4px_24px_rgba(5,15,25,0.4)]">
          <div className="flex justify-between items-center px-4 md:px-8 py-4">
            <div>
              <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent font-headline tracking-tight">Abyssal Navigator</h1>
              <p className="text-xs text-on-surface-variant">{MONTH_NAMES[month]} {now.getFullYear()} · Saudi Riyal (﷼)</p>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="bg-surface-container border border-outline-variant/30 text-on-surface text-xs rounded-full px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <button onClick={reset} title="Reset month data"
                className="p-2 rounded-full hover:bg-white/5 transition-all text-on-surface-variant hover:text-error">
                <span className="material-symbols-outlined text-lg">restart_alt</span>
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8">

          {/* ── DASHBOARD ── */}
          {tab === 0 && (
            <div className="space-y-8">
              {/* Hero */}
              <section className="relative rounded-xl overflow-hidden p-8 md:p-12">
                <div className="absolute inset-0 bg-gradient-to-br from-surface-container-low via-surface-container-highest to-surface" />
                <div className="absolute -top-16 -right-16 w-72 h-72 bg-primary/20 blur-[80px] rounded-full" />
                <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-tertiary/10 blur-[80px] rounded-full" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold">Net Savings Overview</span>
                    <h2 className={`font-headline text-4xl md:text-6xl font-extrabold mt-2 text-glow ${netActual >= 0 ? "text-on-surface" : "text-error"}`}>
                      {fmt(netActual)}
                    </h2>
                    <div className={`mt-2 flex items-center gap-2 text-sm font-medium ${netActual >= 0 ? "text-primary" : "text-error"}`}>
                      <span className="material-symbols-outlined text-sm">{netActual >= 0 ? "trending_up" : "trending_down"}</span>
                      <span>{savingsRate}% savings rate · <span className={healthColorCls}>{health}</span></span>
                    </div>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <div className="glass-card px-5 py-4 rounded-xl ring-1 ring-outline-variant/20">
                      <span className="text-xs text-on-surface-variant block mb-1">Total Budgeted</span>
                      <span className="font-headline text-lg font-bold tabular-nums">{fmt(totalIncomeBudget)}</span>
                    </div>
                    <div className="glass-card px-5 py-4 rounded-xl ring-1 ring-outline-variant/20 bg-primary/5">
                      <span className="text-xs text-primary block mb-1">Total Income</span>
                      <span className="font-headline text-lg font-bold text-primary tabular-nums">{fmt(totalIncomeActual)}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* KPI bento */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface-container-low p-6 rounded-xl relative overflow-hidden group hover:bg-surface-container-high transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <span className="material-symbols-outlined text-6xl text-primary">payments</span>
                  </div>
                  <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Income</span>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-headline tabular-nums">{fmt(totalIncomeActual)}</span>
                    <span className="text-xs text-primary">{totalIncomeBudget > 0 ? `${pct(totalIncomeActual,totalIncomeBudget)}%` : ""}</span>
                  </div>
                  <div className="mt-6 h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full glow-bar transition-all duration-700" style={{width:`${pct(totalIncomeActual,totalIncomeBudget)}%`}} />
                  </div>
                </div>
                <div className="bg-surface-container-low p-6 rounded-xl relative overflow-hidden group hover:bg-surface-container-high transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <span className="material-symbols-outlined text-6xl text-error">receipt_long</span>
                  </div>
                  <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Expenses</span>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-headline tabular-nums">{fmt(totalExpActual)}</span>
                    <span className={`text-xs ${pct(totalExpActual,totalExpBudget)>90?"text-error":"text-on-surface-variant"}`}>
                      {totalExpBudget>0?`${pct(totalExpActual,totalExpBudget)}% of budget`:""}
                    </span>
                  </div>
                  <div className="mt-6 h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 glow-bar-error ${pct(totalExpActual,totalExpBudget)>90?"bg-error":"bg-gradient-to-r from-error to-error-container"}`}
                      style={{width:`${pct(totalExpActual,totalExpBudget)}%`}} />
                  </div>
                </div>
                <div className="bg-surface-container-low p-6 rounded-xl relative overflow-hidden group hover:bg-surface-container-high transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <span className="material-symbols-outlined text-6xl text-tertiary">savings</span>
                  </div>
                  <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Net Savings</span>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className={`text-3xl font-bold font-headline tabular-nums ${netActual<0?"text-error":""}`}>{fmt(netActual)}</span>
                    <span className={`text-xs font-medium ${healthColorCls}`}>{health}</span>
                  </div>
                  <div className="mt-6 h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-tertiary to-tertiary-container rounded-full glow-bar-tertiary transition-all duration-700"
                      style={{width:`${Math.max(0,pct(netActual,totalIncomeActual))}%`}} />
                  </div>
                </div>
              </section>

              {/* Category breakdown + 50/30/20 */}
              <section className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3 bg-surface-container-lowest p-6 md:p-8 rounded-xl ring-1 ring-outline-variant/10">
                  <h2 className="font-headline text-xl font-bold mb-6">Spending by Category</h2>
                  <div className="space-y-4">
                    {Object.entries(sectionTotals).map(([sec,{budgeted,actual}]) => {
                      const p = pct(actual,budgeted);
                      const over = actual>budgeted && budgeted>0;
                      return (
                        <div key={sec}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className={`font-medium ${over?"text-error":"text-on-surface"}`}>{sec}</span>
                            <span className="text-on-surface-variant tabular-nums">{fmt(actual)} / {fmt(budgeted)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${over?"bg-error glow-bar-error":"bg-gradient-to-r from-primary to-primary-container glow-bar"}`}
                              style={{width:`${p}%`}} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-gradient-to-br from-tertiary/20 to-primary/5 p-6 md:p-8 rounded-xl border border-white/5">
                  <span className="material-symbols-outlined text-tertiary mb-4 block">auto_awesome</span>
                  <h3 className="font-headline text-xl font-bold mb-2">50/30/20 Rule</h3>
                  <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">Based on your actual income of {fmt(totalIncomeActual)}</p>
                  <div className="space-y-3">
                    {[
                      {label:"50% Needs",  target:totalIncomeActual*0.5, cls:"text-primary"},
                      {label:"30% Wants",  target:totalIncomeActual*0.3, cls:"text-tertiary"},
                      {label:"20% Savings",target:totalIncomeActual*0.2, cls:"text-emerald-400"},
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center text-sm py-2 border-b border-outline-variant/20">
                        <span className="text-on-surface-variant">{r.label}</span>
                        <span className={`font-bold font-headline tabular-nums ${r.cls}`}>{fmt(r.target)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ── INCOME ── */}
          {tab === 1 && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div>
                  <span className="text-tertiary font-medium tracking-widest text-xs uppercase opacity-80">Monthly Overview</span>
                  <h2 className="text-3xl md:text-4xl font-extrabold font-headline mt-1">Income & <span className="text-primary">Budget</span></h2>
                </div>
                <div className="flex gap-3">
                  <div className="glass-card px-5 py-3 rounded-xl border border-outline-variant/10">
                    <p className="text-on-surface-variant text-xs mb-0.5">Budgeted</p>
                    <p className="text-xl font-bold font-headline tabular-nums">{fmt(totalIncomeBudget)}</p>
                  </div>
                  <div className="glass-card px-5 py-3 rounded-xl border border-outline-variant/10 bg-primary/5">
                    <p className="text-primary text-xs mb-0.5">Actual</p>
                    <p className="text-xl font-bold font-headline text-primary tabular-nums">{fmt(totalIncomeActual)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-surface-container-low rounded-xl overflow-hidden ring-1 ring-outline-variant/10">
                <div className="hidden md:grid grid-cols-[1fr_140px_140px_100px] gap-4 px-6 py-3 bg-surface-container text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  <span>Source</span><span className="text-center">Budgeted {CURRENCY}</span><span className="text-center">Actual {CURRENCY}</span><span className="text-center">% Hit</span>
                </div>
                <div className="divide-y divide-outline-variant/10">
                  {INCOME_CATEGORIES.map(cat => {
                    const p = pct(income[cat]?.actual||0, income[cat]?.budgeted||0);
                    const badgeCls = p>=100?"text-primary bg-primary/10":p>=50?"text-tertiary bg-tertiary/10":"text-error bg-error/10";
                    return (
                      <div key={cat} className="hover:bg-surface-container-high transition-colors">
                        {/* Mobile */}
                        <div className="md:hidden p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-primary text-lg">{INCOME_ICONS[cat]}</span>
                            </div>
                            <span className="font-semibold text-sm flex-1">{cat}</span>
                            {income[cat]?.budgeted>0 && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>{p}%</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-on-surface-variant mb-1 block">Budgeted</label>
                              <input type="number" min="0" inputMode="decimal" value={income[cat]?.budgeted??""} onChange={e=>updateIncome(cat,"budgeted",e.target.value)} className={inputCls} placeholder="0" />
                            </div>
                            <div>
                              <label className="text-xs text-on-surface-variant mb-1 block">Actual</label>
                              <input type="number" min="0" inputMode="decimal" value={income[cat]?.actual??""} onChange={e=>updateIncome(cat,"actual",e.target.value)} className={inputCls} placeholder="0" />
                            </div>
                          </div>
                        </div>
                        {/* Desktop */}
                        <div className="hidden md:grid grid-cols-[1fr_140px_140px_100px] gap-4 px-6 py-3 items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-primary text-base">{INCOME_ICONS[cat]}</span>
                            </div>
                            <span className="text-sm font-medium">{cat}</span>
                          </div>
                          <input type="number" min="0" inputMode="decimal" value={income[cat]?.budgeted??""} onChange={e=>updateIncome(cat,"budgeted",e.target.value)} className={`${inputCls} text-center`} placeholder="0" />
                          <input type="number" min="0" inputMode="decimal" value={income[cat]?.actual??""} onChange={e=>updateIncome(cat,"actual",e.target.value)} className={`${inputCls} text-center`} placeholder="0" />
                          <div className="flex justify-center">
                            {income[cat]?.budgeted>0
                              ? <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeCls}`}>{p}%</span>
                              : <span className="text-on-surface-variant/40">—</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-[1fr_140px_140px_100px] gap-4 px-6 py-4 bg-surface-container border-t-2 border-primary/30">
                  <span className="font-bold text-primary font-headline">TOTAL</span>
                  <span className="text-center font-bold tabular-nums">{fmt(totalIncomeBudget)}</span>
                  <span className="text-center font-bold text-primary tabular-nums">{fmt(totalIncomeActual)}</span>
                  <span className="text-center text-on-surface-variant text-sm">{totalIncomeBudget>0?`${pct(totalIncomeActual,totalIncomeBudget)}%`:"—"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── EXPENSES ── */}
          {tab === 2 && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div>
                  <span className="text-tertiary font-medium tracking-widest text-xs uppercase opacity-80">Monthly Overview</span>
                  <h2 className="text-3xl md:text-4xl font-extrabold font-headline mt-1">Expenses & <span className="text-error">Spend</span></h2>
                </div>
                <div className="flex gap-3">
                  <div className="glass-card px-5 py-3 rounded-xl border border-outline-variant/10">
                    <p className="text-on-surface-variant text-xs mb-0.5">Budgeted</p>
                    <p className="text-xl font-bold font-headline tabular-nums">{fmt(totalExpBudget)}</p>
                  </div>
                  <div className="glass-card px-5 py-3 rounded-xl border border-error/20 bg-error/5">
                    <p className="text-error text-xs mb-0.5">Actual Spent</p>
                    <p className="text-xl font-bold font-headline text-error tabular-nums">{fmt(totalExpActual)}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {Object.entries(EXPENSE_SECTIONS).map(([sec, items]) => {
                  const {budgeted, actual} = sectionTotals[sec];
                  const p = pct(actual, budgeted);
                  const over = actual > budgeted && budgeted > 0;
                  return (
                    <div key={sec} className={`glass-card p-6 rounded-xl border flex flex-col gap-4 transition-all duration-300 ${over?"border-error/20 bg-error/5 hover:bg-error/10":"border-outline-variant/5 hover:bg-surface-container-high/80"}`}>
                      <div className="flex items-start justify-between">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${over?"bg-error/10":"bg-primary/10"}`}>
                          <span className={`material-symbols-outlined text-2xl ${over?"text-error":"text-primary"}`}>{SECTION_ICONS[sec]}</span>
                        </div>
                        {over && <span className="px-2 py-0.5 rounded-md bg-error text-on-error text-[10px] font-bold uppercase tracking-wider">Over Budget</span>}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold font-headline mb-1">{sec.replace(/^\S+\s/, "")}</h3>
                        <div className={`flex justify-between text-xs mb-3 ${over?"text-error font-semibold":"text-on-surface-variant"}`}>
                          <span>Spent: {fmt(actual)}</span>
                          <span>Budget: {fmt(budgeted)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${over?"bg-error glow-bar-error":"bg-gradient-to-r from-primary to-primary-fixed-dim glow-bar"}`}
                            style={{width:`${p}%`}} />
                        </div>
                      </div>
                      <div className="space-y-2 border-t border-outline-variant/10 pt-3">
                        {items.map(item => (
                          <div key={item} className="flex items-center gap-2">
                            <span className="text-xs text-on-surface-variant flex-1 truncate">{item}</span>
                            <input type="number" min="0" inputMode="decimal" value={expenses[item]?.budgeted??""} onChange={e=>updateExp(item,"budgeted",e.target.value)} placeholder="Budget"
                              className="w-20 bg-surface-container-lowest border border-outline-variant/20 rounded px-2 py-1 text-xs text-center text-on-surface focus:outline-none focus:ring-1 focus:ring-primary" />
                            <input type="number" min="0" inputMode="decimal" value={expenses[item]?.actual??""} onChange={e=>updateExp(item,"actual",e.target.value)} placeholder="Actual"
                              className={`w-20 bg-surface-container-lowest border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 ${pct(expenses[item]?.actual||0,expenses[item]?.budgeted||0)>100?"border-error/50 text-error focus:ring-error":"border-outline-variant/20 text-primary focus:ring-primary"}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── LOG ── */}
          {tab === 3 && (
            <div className="space-y-6">
              <div>
                <span className="text-tertiary font-medium tracking-widest text-xs uppercase opacity-80">Activity</span>
                <h2 className="text-3xl md:text-4xl font-extrabold font-headline mt-1">Transaction <span className="text-tertiary">Log</span></h2>
              </div>
              {/* Form */}
              <div className="glass-card rounded-xl p-6 border border-outline-variant/10">
                <h3 className="text-sm font-semibold text-primary mb-5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">add_circle</span>Add Transaction
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1.5 block font-medium uppercase tracking-wider">Date</label>
                      <input type="date" value={logForm.date} onChange={e=>setLogForm(p=>({...p,date:e.target.value}))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1.5 block font-medium uppercase tracking-wider">Type</label>
                      <div className="flex rounded-lg overflow-hidden border border-outline-variant/30">
                        {["Income","Expense"].map(type => (
                          <button key={type} onClick={()=>setLogForm(p=>({...p,type,cat:""}))}
                            className={`flex-1 py-2 text-sm font-semibold transition-all ${logForm.type===type?(type==="Income"?"bg-primary text-on-primary":"bg-error text-on-error"):"bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"}`}>
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-on-surface-variant mb-1.5 block font-medium uppercase tracking-wider">Description</label>
                    <input type="text" placeholder="e.g. Danube groceries" value={logForm.desc} onChange={e=>setLogForm(p=>({...p,desc:e.target.value}))} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1.5 block font-medium uppercase tracking-wider">Amount ({CURRENCY})</label>
                      <input type="number" min="0" inputMode="decimal" placeholder="0" value={logForm.amount} onChange={e=>setLogForm(p=>({...p,amount:e.target.value}))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1.5 block font-medium uppercase tracking-wider">Category</label>
                      <select value={logForm.cat} onChange={e=>setLogForm(p=>({...p,cat:e.target.value}))}
                        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all">
                        <option value="">Select...</option>
                        {logForm.type==="Income"
                          ? INCOME_CATEGORIES.map(c=><option key={c}>{c}</option>)
                          : Object.entries(EXPENSE_SECTIONS).map(([s,items])=>(
                              <optgroup key={s} label={s}>{items.map(i=><option key={i}>{i}</option>)}</optgroup>
                            ))}
                      </select>
                    </div>
                  </div>
                  <button onClick={addLog}
                    className="w-full py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-bold text-sm tracking-wide hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg">
                    <span className="material-symbols-outlined text-base">add</span>Add Entry
                  </button>
                </div>
              </div>
              {/* List */}
              <div className="bg-surface-container-low rounded-xl overflow-hidden ring-1 ring-outline-variant/5">
                <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center">
                  <h3 className="font-headline font-bold text-lg">Recent Flux</h3>
                  <span className="text-xs text-on-surface-variant tabular-nums">{log.length} transactions · {fmt(log.reduce((s,e)=>e.type==="Expense"?s+e.amount:s,0))} expenses</span>
                </div>
                {log.length===0 ? (
                  <div className="py-16 text-center">
                    <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-3">receipt_long</span>
                    <p className="text-on-surface-variant text-sm">No transactions yet. Add your first one above.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-outline-variant/5">
                    {log.map(entry => (
                      <div key={entry.id}
                        className={`flex items-center justify-between p-4 md:p-5 hover:bg-surface-container-high transition-colors ${pulse===entry.id?"animate-[fadeIn_0.4s_ease]":""}`}
                        style={{borderLeft:`3px solid ${entry.type==="Income"?"#9dcbfc":"#ffb4ab"}`}}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                            <span className={`material-symbols-outlined text-base ${entry.type==="Income"?"text-primary":"text-error"}`}>
                              {entry.type==="Income"?"payments":"shopping_bag"}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{entry.desc}</p>
                            <p className="text-xs text-on-surface-variant">{entry.date} · {entry.cat||"Uncategorized"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-bold font-headline tabular-nums ${entry.type==="Income"?"text-primary":"text-error"}`}>
                            {entry.type==="Income"?"+":"-"}{fmt(entry.amount)}
                          </span>
                          <button onClick={()=>deleteLog(entry.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error transition-all">
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-slate-950/80 backdrop-blur-xl border-t border-outline-variant/20">
        <div className="flex">
          {NAV_ITEMS.map((item, i) => (
            <button key={item.label} onClick={()=>setTab(i)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-all ${tab===i?"text-primary":"text-on-surface-variant"}`}>
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        input[type=date]::-webkit-calendar-picker-indicator { filter:invert(0.6); }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#0a141e; }
        ::-webkit-scrollbar-thumb { background:#2c3641; border-radius:4px; }
      `}</style>
    </div>
  );
}
