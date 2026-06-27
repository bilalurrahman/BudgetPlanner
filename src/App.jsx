import { useState, useEffect, useRef, useMemo } from "react";

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

// item name → its section key (for transaction-feed icons)
const EXPENSE_SECTIONS_LOOKUP = {};
Object.entries(EXPENSE_SECTIONS).forEach(([sec, items]) => items.forEach(i => { EXPENSE_SECTIONS_LOOKUP[i] = sec; }));

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

// Distinct hues for the donut / category visuals
const SECTION_COLORS = {
  "🏠 Housing":       "#9dcbfc",
  "🚗 Transport":     "#d5bbfd",
  "🛒 Food":          "#7ee0c0",
  "💊 Health":        "#ffb4ab",
  "📱 Subscriptions": "#ffd479",
  "👨‍👩‍👧 Family":        "#f5a3c7",
  "🎯 Personal":      "#a3cbef",
  "🎓 Education":     "#b39ddb",
  "💰 Savings":       "#8be9a8",
};

// 50 / 30 / 20 mapping
const RULE_BUCKET = {
  "🏠 Housing": "needs", "🚗 Transport": "needs", "🛒 Food": "needs",
  "💊 Health": "needs", "👨‍👩‍👧 Family": "needs",
  "📱 Subscriptions": "wants", "🎯 Personal": "wants", "🎓 Education": "wants",
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
  return `${CURRENCY}${Math.round(Number(n)).toLocaleString("en-SA")}`;
}
function fmtCompact(n) {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) >= 1000) return `${CURRENCY}${(v / 1000).toFixed(1)}k`;
  return `${CURRENCY}${v}`;
}

function buildInitial() {
  const income = {};
  INCOME_CATEGORIES.forEach(c => { income[c] = { budgeted: 0, actual: 0 }; });
  const expenses = {};
  Object.entries(EXPENSE_SECTIONS).forEach(([sec, items]) => {
    items.forEach(item => { expenses[item] = { budgeted: 0, actual: 0, section: sec }; });
  });
  return { income, expenses, log: [] };
}

const STORAGE_KEY = "rabt_budget_v2";
const LEGACY_KEY = "rabt_budget_v1";
const monthKey = (year, m) => `${year}-${String(m + 1).padStart(2, "0")}`;

function loadStore() {
  try {
    const raw = window.localStorage?.getItem?.(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // One-time migration from the old single-bucket format
    const legacy = window.localStorage?.getItem?.(LEGACY_KEY);
    if (legacy) {
      const o = JSON.parse(legacy);
      const k = monthKey(now.getFullYear(), now.getMonth());
      return { [k]: { income: o.income, expenses: o.expenses, log: o.log || [] } };
    }
  } catch {}
  return {};
}
function saveStore(store) {
  try { window.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(store)); } catch {}
}

/* ─────────────────────────── small viz helpers ─────────────────────────── */

// Eased count-up that animates whenever the target value changes
function useCountUp(value, duration = 900) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const start = fromRef.current;
    const end = Number(value) || 0;
    if (start === end) return;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      const cur = start + (end - start) * e;
      setDisplay(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

function DonutChart({ segments, size = 200, thickness = 26, center, sub }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[210px] mx-auto">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#17202b" strokeWidth={thickness} />
        {total > 0 && segments.map((s, i) => {
          const dash = (s.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc}
              style={{ transition: "stroke-dasharray .9s ease, stroke-dashoffset .9s ease" }} />
          );
          acc += dash;
          return el;
        })}
      </g>
      <text x="50%" y="46%" textAnchor="middle" className="fill-on-surface font-headline"
        style={{ fontSize: size * 0.13, fontWeight: 800 }}>{center}</text>
      <text x="50%" y="60%" textAnchor="middle" className="fill-on-surface-variant"
        style={{ fontSize: size * 0.055, letterSpacing: 1.5, textTransform: "uppercase" }}>{sub}</text>
    </svg>
  );
}

function RadialGauge({ pct, size = 168, thickness = 16, color = "#9dcbfc", label, value }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;
  const id = useRef(`g${Math.random().toString(36).slice(2)}`).current;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[180px] mx-auto">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#17202b" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={thickness}
          strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray .9s ease", filter: `drop-shadow(0 0 6px ${color}88)` }} />
      </g>
      <text x="50%" y="47%" textAnchor="middle" className="fill-on-surface font-headline"
        style={{ fontSize: size * 0.2, fontWeight: 800 }}>{value}</text>
      <text x="50%" y="62%" textAnchor="middle" className="fill-on-surface-variant"
        style={{ fontSize: size * 0.07, letterSpacing: 1, textTransform: "uppercase" }}>{label}</text>
    </svg>
  );
}

// Budgetum-style circular category dial — emoji center, ring fills to % of budget
function RingDial({ pct, color, over, emoji, size = 80, thickness = 7 }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;
  const stroke = over ? "#ffb4ab" : color;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1b2530" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={thickness}
          strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray .8s ease", filter: `drop-shadow(0 0 4px ${stroke}99)` }} />
      </g>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: size * 0.34 }}>{emoji}</text>
    </svg>
  );
}

// Editorial section label: "01 — OVERVIEW" with a trailing hairline rule
function Eyebrow({ index, children, accent = "text-primary" }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={`font-display text-xs font-bold tabular-nums ${accent}`}>{index}</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-on-surface-variant">{children}</span>
      <span className="hairline flex-1" />
    </div>
  );
}

/* ─────────────────────────────── app ─────────────────────────────── */

export default function BudgetApp() {
  const [tab, setTab] = useState(0);
  const [month, setMonth] = useState(now.getMonth());
  const [store, setStore] = useState(loadStore);
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0, 10), desc: "", amount: "", type: "Expense", cat: "" });
  const [pulse, setPulse] = useState(null);

  const year = now.getFullYear();
  const key = monthKey(year, month);

  useEffect(() => { saveStore(store); }, [store]);

  // Current month's working data (fresh template if untouched)
  const cur = store[key] || buildInitial();
  const income = cur.income || buildInitial().income;
  const expenses = cur.expenses || buildInitial().expenses;
  const log = cur.log || [];

  function patchBucket(updater) {
    setStore(prev => {
      const base = prev[key] || buildInitial();
      return { ...prev, [key]: updater(base) };
    });
  }

  const totalIncomeBudget = Object.values(income).reduce((s, v) => s + (Number(v.budgeted) || 0), 0);
  const totalIncomeActual = Object.values(income).reduce((s, v) => s + (Number(v.actual) || 0), 0);
  const totalExpBudget    = Object.values(expenses).reduce((s, v) => s + (Number(v.budgeted) || 0), 0);
  const totalExpActual    = Object.values(expenses).reduce((s, v) => s + (Number(v.actual) || 0), 0);
  const netBudget = totalIncomeBudget - totalExpBudget;
  const netActual = totalIncomeActual - totalExpActual;
  const savingsRate = totalIncomeActual > 0 ? ((netActual / totalIncomeActual) * 100).toFixed(1) : 0;
  const budgetUsed = totalIncomeActual > 0 ? Math.round((totalExpActual / totalIncomeActual) * 100) : 0;

  // Animated headline numbers
  const netAnim = useCountUp(netActual);
  const incomeAnim = useCountUp(totalIncomeActual);
  const expenseAnim = useCountUp(totalExpActual);

  function updateIncome(cat, field, val) {
    patchBucket(c => ({ ...c, income: { ...c.income, [cat]: { ...c.income[cat], [field]: val === "" ? "" : Number(val) } } }));
  }
  function updateExp(item, field, val) {
    patchBucket(c => ({ ...c, expenses: { ...c.expenses, [item]: { ...c.expenses[item], [field]: val === "" ? "" : Number(val) } } }));
  }
  function addLog() {
    if (!logForm.desc || !logForm.amount) return;
    const entry = { ...logForm, id: Date.now(), amount: Number(logForm.amount) };
    patchBucket(c => {
      const next = { ...c, log: [entry, ...(c.log || [])] };
      if (entry.type === "Income" && next.income[entry.cat]) {
        next.income = { ...next.income, [entry.cat]: { ...next.income[entry.cat], actual: (Number(next.income[entry.cat].actual) || 0) + entry.amount } };
      } else if (entry.type === "Expense" && next.expenses[entry.cat]) {
        next.expenses = { ...next.expenses, [entry.cat]: { ...next.expenses[entry.cat], actual: (Number(next.expenses[entry.cat].actual) || 0) + entry.amount } };
      }
      return next;
    });
    setPulse(entry.id);
    setLogForm(p => ({ ...p, desc: "", amount: "", cat: "" }));
  }
  function deleteLog(id) {
    patchBucket(c => ({ ...c, log: (c.log || []).filter(e => e.id !== id) }));
  }
  function reset() {
    if (!confirm(`Reset all data for ${MONTH_NAMES[month]} ${year}?`)) return;
    setStore(prev => ({ ...prev, [key]: buildInitial() }));
  }

  const pct = (a, b) => b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
  const health = netActual >= 0 ? (savingsRate >= 20 ? "Healthy" : savingsRate >= 5 ? "Okay" : "Watch Out") : "Over Budget";
  const healthColorCls = health === "Healthy" ? "text-emerald-400" : health === "Okay" ? "text-yellow-400" : health === "Watch Out" ? "text-orange-400" : "text-error";
  const gaugeColor = netActual >= 0 ? (savingsRate >= 20 ? "#8be9a8" : "#9dcbfc") : "#ffb4ab";

  const sectionTotals = {};
  Object.entries(EXPENSE_SECTIONS).forEach(([sec, items]) => {
    sectionTotals[sec] = { budgeted: 0, actual: 0 };
    items.forEach(item => {
      sectionTotals[sec].budgeted += Number(expenses[item]?.budgeted) || 0;
      sectionTotals[sec].actual   += Number(expenses[item]?.actual) || 0;
    });
  });

  // Donut segments (only sections with actual spend), sorted big→small
  const donutSegments = Object.entries(sectionTotals)
    .map(([sec, t]) => ({ label: sec, value: t.actual, color: SECTION_COLORS[sec] }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value);

  // 50/30/20 actuals
  const ruleActual = { needs: 0, wants: 0, savings: 0 };
  Object.entries(sectionTotals).forEach(([sec, t]) => {
    const b = RULE_BUCKET[sec]; if (b) ruleActual[b] += t.actual;
  });

  // Cash-flow mini chart — net per day from the last (chronological) entries
  const cashFlow = useMemo(() => {
    const byDay = {};
    [...log].forEach(e => {
      const d = e.date || "";
      byDay[d] = (byDay[d] || 0) + (e.type === "Income" ? e.amount : -e.amount);
    });
    return Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([d, v]) => ({ d, v }));
  }, [log]);
  const cashMax = Math.max(1, ...cashFlow.map(p => Math.abs(p.v)));

  // Ticker-tape items — headline stats + recent transactions
  const tickerItems = [
    { k: "NET", v: fmt(netActual), tone: netActual >= 0 ? "pos" : "neg" },
    { k: "INCOME", v: fmt(totalIncomeActual), tone: "pos" },
    { k: "SPENT", v: fmt(totalExpActual), tone: "neg" },
    { k: "SAVINGS RATE", v: `${savingsRate}%`, tone: "pos" },
    { k: "STATUS", v: health.toUpperCase(), tone: netActual >= 0 ? "pos" : "neg" },
    ...log.slice(0, 6).map(e => ({
      k: (e.desc || "TXN").toUpperCase(),
      v: `${e.type === "Income" ? "+" : "−"}${fmt(e.amount)}`,
      tone: e.type === "Income" ? "pos" : "neg",
    })),
  ];

  // Group the log by day (newest first) with per-day subtotals — Budgetum "Track Expenses" style
  const logByDay = useMemo(() => {
    const g = {};
    log.forEach(e => { (g[e.date] || (g[e.date] = [])).push(e); });
    return Object.keys(g).sort((a, b) => b.localeCompare(a)).map(date => {
      const entries = g[date];
      const inc = entries.reduce((s, e) => e.type === "Income" ? s + e.amount : s, 0);
      const exp = entries.reduce((s, e) => e.type === "Expense" ? s + e.amount : s, 0);
      let label = date;
      try {
        label = new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      } catch {}
      return { date, label, entries, inc, exp, net: inc - exp };
    });
  }, [log]);

  const inputCls = "w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all";

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-tertiary/10 blur-[100px] rounded-full -z-10 pointer-events-none" />
      {/* Film grain */}
      <div className="grain" />

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
              <p className="text-xs text-on-surface-variant">{MONTH_NAMES[month]} {year} · Saudi Riyal (﷼)</p>
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
            <div className="space-y-6 md:space-y-8">
              {/* Ticker tape */}
              <div className="marquee reveal -mx-4 md:-mx-8 -mt-2 md:mt-0 overflow-hidden border-y border-white/5 bg-slate-950/40 backdrop-blur-sm py-2.5">
                <div className="marquee-track">
                  {[...tickerItems, ...tickerItems].map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-2 px-6 text-[11px] uppercase tracking-[0.2em]">
                      <span className="text-on-surface-variant/60">{t.k}</span>
                      <span className={`font-display font-semibold tabular-nums ${t.tone === "pos" ? "text-primary" : "text-error"}`}>{t.v}</span>
                      <span className="text-outline-variant/40">/</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Hero — editorial, oversized */}
              <section className="reveal relative rounded-[1.5rem] overflow-hidden ring-1 ring-white/5">
                <div className="absolute inset-0 bg-gradient-to-br from-surface-container-low via-surface-container-highest to-surface" />
                <div className="aurora absolute -top-24 -right-10 w-[420px] h-[420px] rounded-full blur-[90px] opacity-60" />
                <div className="aurora-2 absolute -bottom-24 -left-10 w-[360px] h-[360px] rounded-full blur-[90px] opacity-50" />
                {/* Oversized backdrop month name */}
                <div className="ghost-type absolute -bottom-8 -right-4 text-[28vw] md:text-[14rem] select-none pointer-events-none z-0 uppercase">
                  {MONTHS[month]}
                </div>
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 p-7 md:p-12 items-center">
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <span className="font-display text-xs font-bold text-primary tabular-nums">00</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-on-surface-variant">Net Position</span>
                    </div>
                    <h2 className="font-serif italic text-2xl md:text-3xl text-on-surface-variant/90 leading-none">
                      You've kept
                    </h2>
                    <h2 className={`font-display font-bold text-6xl md:text-8xl mt-1 tracking-tight tabular-nums text-glow leading-[0.9] ${netActual >= 0 ? "text-on-surface" : "text-error"}`}>
                      {fmt(netAnim)}
                    </h2>
                    <h2 className="font-serif italic text-2xl md:text-3xl text-on-surface-variant/90 mt-1 leading-none">
                      this <span className="text-primary">{MONTH_NAMES[month]}</span>.
                    </h2>
                    <div className={`mt-6 inline-flex items-center gap-2 text-sm font-medium px-3.5 py-1.5 rounded-full ${netActual >= 0 ? "bg-primary/10 text-primary" : "bg-error/10 text-error"}`}>
                      <span className="material-symbols-outlined text-base">{netActual >= 0 ? "trending_up" : "trending_down"}</span>
                      <span>{savingsRate}% savings rate · <span className={healthColorCls}>{health}</span></span>
                    </div>
                    <div className="mt-8 grid grid-cols-3 gap-px bg-white/5 rounded-xl overflow-hidden ring-1 ring-white/5">
                      {[
                        { l: "Income", v: fmt(totalIncomeActual), c: "text-primary" },
                        { l: "Expenses", v: fmt(totalExpActual), c: "text-error" },
                        { l: "Planned Net", v: fmt(netBudget), c: netBudget >= 0 ? "text-on-surface" : "text-error" },
                      ].map(s => (
                        <div key={s.l} className="bg-slate-950/40 backdrop-blur-sm px-4 py-3">
                          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block mb-1">{s.l}</span>
                          <span className={`font-display text-base md:text-lg font-semibold tabular-nums ${s.c}`}>{s.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <RadialGauge pct={netActual >= 0 ? Number(savingsRate) : budgetUsed}
                      color={gaugeColor}
                      value={`${netActual >= 0 ? savingsRate : budgetUsed}%`}
                      label={netActual >= 0 ? "saved" : "of income"} />
                    <p className="text-xs text-on-surface-variant mt-2 text-center font-display tracking-wide">
                      {budgetUsed}% OF INCOME SPENT
                    </p>
                  </div>
                </div>
              </section>

              {/* KPI bento */}
              <section className="reveal" style={{ animationDelay: "0.05s" }}>
                <Eyebrow index="01" accent="text-primary">The Pulse</Eyebrow>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                {[
                  { label: "Total Income", icon: "payments", color: "text-primary", anim: incomeAnim,
                    barCls: "bg-gradient-to-r from-primary to-primary-container glow-bar",
                    p: pct(totalIncomeActual, totalIncomeBudget), sub: totalIncomeBudget > 0 ? `${pct(totalIncomeActual, totalIncomeBudget)}% of plan` : "" },
                  { label: "Total Expenses", icon: "receipt_long", color: "text-error", anim: expenseAnim,
                    barCls: pct(totalExpActual, totalExpBudget) > 90 ? "bg-error glow-bar-error" : "bg-gradient-to-r from-error to-error-container glow-bar-error",
                    p: pct(totalExpActual, totalExpBudget), sub: totalExpBudget > 0 ? `${pct(totalExpActual, totalExpBudget)}% of budget` : "" },
                  { label: "Net Savings", icon: "savings", color: "text-tertiary", anim: netAnim, neg: netActual < 0,
                    barCls: "bg-gradient-to-r from-tertiary to-tertiary-container glow-bar-tertiary",
                    p: Math.max(0, pct(netActual, totalIncomeActual)), sub: health },
                ].map(k => (
                  <div key={k.label} className="bg-surface-container-low p-6 rounded-2xl relative overflow-hidden group hover:bg-surface-container-high transition-colors ring-1 ring-white/5">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className={`material-symbols-outlined text-6xl ${k.color}`}>{k.icon}</span>
                    </div>
                    <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{k.label}</span>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className={`text-3xl md:text-4xl font-bold font-display tracking-tight tabular-nums ${k.neg ? "text-error" : ""}`}>{fmt(k.anim)}</span>
                      <span className={`text-xs ${k.color}`}>{k.sub}</span>
                    </div>
                    <div className="mt-6 h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${k.barCls}`} style={{ width: `${k.p}%` }} />
                    </div>
                  </div>
                ))}
                </div>
              </section>

              {/* Donut allocation + Spending bars */}
              <section className="reveal" style={{ animationDelay: "0.1s" }}>
                <Eyebrow index="02" accent="text-tertiary">Allocation</Eyebrow>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
                {/* Donut */}
                <div className="lg:col-span-2 bg-surface-container-lowest p-6 md:p-7 rounded-2xl ring-1 ring-outline-variant/10">
                  <h2 className="font-headline text-lg font-bold mb-1">Expense Allocation</h2>
                  <p className="text-xs text-on-surface-variant mb-5">Where your money went this month</p>
                  {donutSegments.length > 0 ? (
                    <>
                      <DonutChart segments={donutSegments} center={fmtCompact(totalExpActual)} sub="spent" />
                      <div className="mt-6 space-y-2">
                        {donutSegments.slice(0, 5).map(s => (
                          <div key={s.label} className="flex items-center gap-2 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                            <span className="flex-1 text-on-surface-variant truncate">{s.label}</span>
                            <span className="tabular-nums text-on-surface">{Math.round((s.value / totalExpActual) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-16 text-center text-on-surface-variant/50 text-sm">
                      <span className="material-symbols-outlined text-4xl block mb-2">donut_large</span>
                      Add expenses to see your allocation
                    </div>
                  )}
                </div>

                {/* Spending by category */}
                <div className="lg:col-span-3 bg-surface-container-lowest p-6 md:p-8 rounded-2xl ring-1 ring-outline-variant/10">
                  <h2 className="font-headline text-lg font-bold mb-5">Spending by Category</h2>
                  <div className="space-y-3.5">
                    {Object.entries(sectionTotals).map(([sec, { budgeted, actual }]) => {
                      const p = pct(actual, budgeted);
                      const over = actual > budgeted && budgeted > 0;
                      return (
                        <div key={sec}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className={`font-medium ${over ? "text-error" : "text-on-surface"}`}>{sec}</span>
                            <span className="text-on-surface-variant tabular-nums">{fmt(actual)} / {fmt(budgeted)}</span>
                          </div>
                          <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${p}%`, background: over ? "#ffb4ab" : SECTION_COLORS[sec],
                                boxShadow: `0 0 10px ${over ? "#ffb4ab" : SECTION_COLORS[sec]}66` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>
              </section>

              {/* Cash flow + 50/30/20 */}
              <section className="reveal" style={{ animationDelay: "0.15s" }}>
                <Eyebrow index="03" accent="text-emerald-400">Flow & Rule</Eyebrow>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
                {/* Cash flow */}
                <div className="lg:col-span-3 bg-surface-container-lowest p-6 md:p-8 rounded-2xl ring-1 ring-outline-variant/10">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-headline text-lg font-bold">Daily Cash Flow</h2>
                      <p className="text-xs text-on-surface-variant">Net movement per logged day</p>
                    </div>
                    <span className="material-symbols-outlined text-tertiary">show_chart</span>
                  </div>
                  {cashFlow.length > 0 ? (
                    <div className="flex items-end justify-between gap-2 h-44">
                      {cashFlow.map((p, i) => {
                        const h = (Math.abs(p.v) / cashMax) * 100;
                        const pos = p.v >= 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                            <span className="text-[10px] mb-1 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: pos ? "#8be9a8" : "#ffb4ab" }}>{fmtCompact(p.v)}</span>
                            <div className="w-full rounded-t-md transition-all duration-500"
                              style={{ height: `${Math.max(4, h)}%`,
                                background: pos ? "linear-gradient(180deg,#8be9a8,#2e8b6a)" : "linear-gradient(180deg,#ffb4ab,#93000a)",
                                boxShadow: `0 0 10px ${pos ? "#8be9a855" : "#ffb4ab55"}` }} />
                            <span className="text-[9px] text-on-surface-variant mt-1.5">{p.d.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-on-surface-variant/50 text-sm">
                      <span className="material-symbols-outlined text-4xl block mb-2">bar_chart</span>
                      Log transactions to chart your cash flow
                    </div>
                  )}
                </div>

                {/* 50/30/20 with progress vs target */}
                <div className="lg:col-span-2 bg-gradient-to-br from-tertiary/20 to-primary/5 p-6 md:p-7 rounded-2xl border border-white/5">
                  <span className="material-symbols-outlined text-tertiary mb-3 block">auto_awesome</span>
                  <h3 className="font-headline text-lg font-bold mb-1">50 / 30 / 20 Rule</h3>
                  <p className="text-xs text-on-surface-variant mb-5">vs your income of {fmt(totalIncomeActual)}</p>
                  <div className="space-y-4">
                    {[
                      { label: "Needs", share: 0.5, actual: ruleActual.needs, cls: "#9dcbfc" },
                      { label: "Wants", share: 0.3, actual: ruleActual.wants, cls: "#d5bbfd" },
                      { label: "Savings", share: 0.2, actual: Math.max(ruleActual.savings, netActual), cls: "#8be9a8" },
                    ].map(r => {
                      const target = totalIncomeActual * r.share;
                      const p = target > 0 ? Math.min(100, Math.round((r.actual / target) * 100)) : 0;
                      const over = r.label !== "Savings" && r.actual > target && target > 0;
                      return (
                        <div key={r.label}>
                          <div className="flex justify-between items-baseline text-xs mb-1.5">
                            <span className="text-on-surface-variant">{Math.round(r.share * 100)}% {r.label}</span>
                            <span className="tabular-nums font-medium">
                              <span style={{ color: over ? "#ffb4ab" : r.cls }}>{fmt(r.actual)}</span>
                              <span className="text-on-surface-variant"> / {fmt(target)}</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest/60 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${p}%`, background: over ? "#ffb4ab" : r.cls }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>
              </section>
            </div>
          )}

          {/* ── INCOME ── */}
          {tab === 1 && (
            <div className="space-y-6 reveal">
              <Eyebrow index="◇" accent="text-primary">Income · {MONTH_NAMES[month]}</Eyebrow>
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div>
                  <h2 className="font-serif italic text-2xl text-on-surface-variant/90 leading-none">Everything that</h2>
                  <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight mt-1">came <span className="text-primary">in</span>.</h2>
                </div>
                <div className="flex gap-px bg-white/5 rounded-xl overflow-hidden ring-1 ring-white/5">
                  <div className="bg-slate-950/40 px-5 py-3">
                    <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-0.5">Budgeted</p>
                    <p className="text-xl font-semibold font-display tabular-nums">{fmt(totalIncomeBudget)}</p>
                  </div>
                  <div className="bg-slate-950/40 px-5 py-3">
                    <p className="text-primary text-[10px] uppercase tracking-wider mb-0.5">Actual</p>
                    <p className="text-xl font-semibold font-display text-primary tabular-nums">{fmt(totalIncomeActual)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-surface-container-low rounded-xl overflow-hidden ring-1 ring-outline-variant/10">
                <div className="hidden md:grid grid-cols-[1fr_140px_140px_100px] gap-4 px-6 py-3 bg-surface-container text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  <span>Source</span><span className="text-center">Budgeted {CURRENCY}</span><span className="text-center">Actual {CURRENCY}</span><span className="text-center">% Hit</span>
                </div>
                <div className="divide-y divide-outline-variant/10">
                  {INCOME_CATEGORIES.map(cat => {
                    const p = pct(income[cat]?.actual || 0, income[cat]?.budgeted || 0);
                    const badgeCls = p >= 100 ? "text-primary bg-primary/10" : p >= 50 ? "text-tertiary bg-tertiary/10" : "text-error bg-error/10";
                    return (
                      <div key={cat} className="hover:bg-surface-container-high transition-colors">
                        {/* Mobile */}
                        <div className="md:hidden p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-primary text-lg">{INCOME_ICONS[cat]}</span>
                            </div>
                            <span className="font-semibold text-sm flex-1">{cat}</span>
                            {income[cat]?.budgeted > 0 && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>{p}%</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-on-surface-variant mb-1 block">Budgeted</label>
                              <input type="number" min="0" inputMode="decimal" value={income[cat]?.budgeted ?? ""} onChange={e => updateIncome(cat, "budgeted", e.target.value)} className={inputCls} placeholder="0" />
                            </div>
                            <div>
                              <label className="text-xs text-on-surface-variant mb-1 block">Actual</label>
                              <input type="number" min="0" inputMode="decimal" value={income[cat]?.actual ?? ""} onChange={e => updateIncome(cat, "actual", e.target.value)} className={inputCls} placeholder="0" />
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
                          <input type="number" min="0" inputMode="decimal" value={income[cat]?.budgeted ?? ""} onChange={e => updateIncome(cat, "budgeted", e.target.value)} className={`${inputCls} text-center`} placeholder="0" />
                          <input type="number" min="0" inputMode="decimal" value={income[cat]?.actual ?? ""} onChange={e => updateIncome(cat, "actual", e.target.value)} className={`${inputCls} text-center`} placeholder="0" />
                          <div className="flex justify-center">
                            {income[cat]?.budgeted > 0
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
                  <span className="text-center text-on-surface-variant text-sm">{totalIncomeBudget > 0 ? `${pct(totalIncomeActual, totalIncomeBudget)}%` : "—"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── EXPENSES ── */}
          {tab === 2 && (
            <div className="space-y-6 md:space-y-8">
              <div className="reveal">
                <Eyebrow index="◇" accent="text-error">Expenses · {MONTH_NAMES[month]}</Eyebrow>
                <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                  <div>
                    <h2 className="font-serif italic text-2xl text-on-surface-variant/90 leading-none">Everything that</h2>
                    <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight mt-1">went <span className="text-error">out</span>.</h2>
                  </div>
                  <div className="flex gap-px bg-white/5 rounded-xl overflow-hidden ring-1 ring-white/5">
                    <div className="bg-slate-950/40 px-5 py-3">
                      <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-0.5">Budgeted</p>
                      <p className="text-xl font-semibold font-display tabular-nums">{fmt(totalExpBudget)}</p>
                    </div>
                    <div className="bg-slate-950/40 px-5 py-3">
                      <p className="text-error text-[10px] uppercase tracking-wider mb-0.5">Spent</p>
                      <p className="text-xl font-semibold font-display text-error tabular-nums">{fmt(totalExpActual)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category dials */}
              <section className="reveal" style={{ animationDelay: "0.05s" }}>
                <Eyebrow index="01" accent="text-primary">Category Dials</Eyebrow>
                <div className="bg-surface-container-lowest rounded-2xl ring-1 ring-outline-variant/10 p-6 md:p-8">
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-4 md:gap-3">
                    {Object.entries(EXPENSE_SECTIONS).map(([sec]) => {
                      const { budgeted, actual } = sectionTotals[sec];
                      const p = pct(actual, budgeted);
                      const over = actual > budgeted && budgeted > 0;
                      return (
                        <div key={sec} className="flex flex-col items-center text-center">
                          <div className="w-16 md:w-[68px] hover:scale-105 transition-transform">
                            <RingDial pct={p} color={SECTION_COLORS[sec]} over={over} emoji={sec.split(" ")[0]} />
                          </div>
                          <span className="text-[10px] text-on-surface-variant mt-2 truncate w-full">{sec.replace(/^\S+\s/, "")}</span>
                          <span className="text-[11px] font-display font-semibold tabular-nums" style={{ color: over ? "#ffb4ab" : SECTION_COLORS[sec] }}>{fmtCompact(actual)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="reveal" style={{ animationDelay: "0.1s" }}>
                <Eyebrow index="02" accent="text-tertiary">Detailed Budgets</Eyebrow>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {Object.entries(EXPENSE_SECTIONS).map(([sec, items]) => {
                  const { budgeted, actual } = sectionTotals[sec];
                  const p = pct(actual, budgeted);
                  const over = actual > budgeted && budgeted > 0;
                  return (
                    <div key={sec} className={`glass-card p-6 rounded-xl border flex flex-col gap-4 transition-all duration-300 ${over ? "border-error/20 bg-error/5 hover:bg-error/10" : "border-outline-variant/5 hover:bg-surface-container-high/80"}`}>
                      <div className="flex items-start justify-between">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${over ? "bg-error/10" : "bg-primary/10"}`}>
                          <span className={`material-symbols-outlined text-2xl ${over ? "text-error" : "text-primary"}`}>{SECTION_ICONS[sec]}</span>
                        </div>
                        {over && <span className="px-2 py-0.5 rounded-md bg-error text-on-error text-[10px] font-bold uppercase tracking-wider">Over Budget</span>}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold font-display tracking-tight mb-1">{sec.replace(/^\S+\s/, "")}</h3>
                        <div className={`flex justify-between text-xs mb-3 ${over ? "text-error font-semibold" : "text-on-surface-variant"}`}>
                          <span>Spent: {fmt(actual)}</span>
                          <span>Budget: {fmt(budgeted)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${p}%`, background: over ? "#ffb4ab" : SECTION_COLORS[sec], boxShadow: `0 0 10px ${over ? "#ffb4ab" : SECTION_COLORS[sec]}66` }} />
                        </div>
                      </div>
                      <div className="space-y-2 border-t border-outline-variant/10 pt-3">
                        {items.map(item => (
                          <div key={item} className="flex items-center gap-2">
                            <span className="text-xs text-on-surface-variant flex-1 truncate">{item}</span>
                            <input type="number" min="0" inputMode="decimal" value={expenses[item]?.budgeted ?? ""} onChange={e => updateExp(item, "budgeted", e.target.value)} placeholder="Budget"
                              className="w-20 bg-surface-container-lowest border border-outline-variant/20 rounded px-2 py-1 text-xs text-center text-on-surface focus:outline-none focus:ring-1 focus:ring-primary" />
                            <input type="number" min="0" inputMode="decimal" value={expenses[item]?.actual ?? ""} onChange={e => updateExp(item, "actual", e.target.value)} placeholder="Actual"
                              className={`w-20 bg-surface-container-lowest border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 ${pct(expenses[item]?.actual || 0, expenses[item]?.budgeted || 0) > 100 ? "border-error/50 text-error focus:ring-error" : "border-outline-variant/20 text-primary focus:ring-primary"}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              </section>
            </div>
          )}

          {/* ── LOG ── */}
          {tab === 3 && (
            <div className="space-y-6 reveal">
              <div>
                <Eyebrow index="◇" accent="text-tertiary">Activity</Eyebrow>
                <h2 className="font-serif italic text-2xl text-on-surface-variant/90 leading-none">Your money,</h2>
                <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight mt-1">in <span className="text-tertiary">motion</span>.</h2>
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
                      <input type="date" value={logForm.date} onChange={e => setLogForm(p => ({ ...p, date: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1.5 block font-medium uppercase tracking-wider">Type</label>
                      <div className="flex rounded-lg overflow-hidden border border-outline-variant/30">
                        {["Income", "Expense"].map(type => (
                          <button key={type} onClick={() => setLogForm(p => ({ ...p, type, cat: "" }))}
                            className={`flex-1 py-2 text-sm font-semibold transition-all ${logForm.type === type ? (type === "Income" ? "bg-primary text-on-primary" : "bg-error text-on-error") : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"}`}>
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-on-surface-variant mb-1.5 block font-medium uppercase tracking-wider">Description</label>
                    <input type="text" placeholder="e.g. Danube groceries" value={logForm.desc} onChange={e => setLogForm(p => ({ ...p, desc: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1.5 block font-medium uppercase tracking-wider">Amount ({CURRENCY})</label>
                      <input type="number" min="0" inputMode="decimal" placeholder="0" value={logForm.amount} onChange={e => setLogForm(p => ({ ...p, amount: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1.5 block font-medium uppercase tracking-wider">Category</label>
                      <select value={logForm.cat} onChange={e => setLogForm(p => ({ ...p, cat: e.target.value }))}
                        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all">
                        <option value="">Select...</option>
                        {logForm.type === "Income"
                          ? INCOME_CATEGORIES.map(c => <option key={c}>{c}</option>)
                          : Object.entries(EXPENSE_SECTIONS).map(([s, items]) => (
                            <optgroup key={s} label={s}>{items.map(i => <option key={i}>{i}</option>)}</optgroup>
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
              {/* Day-grouped feed */}
              <div>
                <Eyebrow index="01" accent="text-primary">Recent Flux</Eyebrow>
                {log.length === 0 ? (
                  <div className="bg-surface-container-low rounded-2xl ring-1 ring-outline-variant/5 py-16 text-center">
                    <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-3">receipt_long</span>
                    <p className="text-on-surface-variant text-sm">No transactions yet. Add your first one above.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {logByDay.map(day => (
                      <div key={day.date}>
                        {/* Day header */}
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{day.label}</span>
                          <div className="flex items-center gap-3 text-[11px] tabular-nums">
                            {day.inc > 0 && <span className="text-primary">+{fmt(day.inc)}</span>}
                            {day.exp > 0 && <span className="text-error">−{fmt(day.exp)}</span>}
                            <span className={`font-display font-semibold ${day.net >= 0 ? "text-on-surface" : "text-error"}`}>{day.net >= 0 ? "+" : "−"}{fmt(Math.abs(day.net))}</span>
                          </div>
                        </div>
                        {/* Entries */}
                        <div className="bg-surface-container-low rounded-2xl ring-1 ring-outline-variant/5 overflow-hidden divide-y divide-outline-variant/5">
                          {day.entries.map(entry => (
                            <div key={entry.id}
                              className={`flex items-center justify-between p-4 hover:bg-surface-container-high transition-colors ${pulse === entry.id ? "animate-[fadeIn_0.4s_ease]" : ""}`}
                              style={{ borderLeft: `3px solid ${entry.type === "Income" ? "#9dcbfc" : "#ffb4ab"}` }}>
                              <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                                  style={{ background: entry.type === "Income" ? "rgba(157,203,252,0.12)" : `${(SECTION_COLORS[EXPENSE_SECTIONS_LOOKUP[entry.cat]] || "#ffb4ab")}22` }}>
                                  {entry.type === "Income" ? "💸" : (EXPENSE_SECTIONS_LOOKUP[entry.cat] || "🛒").split(" ")[0]}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm">{entry.desc}</p>
                                  <p className="text-xs text-on-surface-variant">{entry.cat || "Uncategorized"}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`font-semibold font-display tabular-nums ${entry.type === "Income" ? "text-primary" : "text-error"}`}>
                                  {entry.type === "Income" ? "+" : "−"}{fmt(entry.amount)}
                                </span>
                                <button onClick={() => deleteLog(entry.id)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error transition-all">
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </div>
                          ))}
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
            <button key={item.label} onClick={() => setTab(i)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-all ${tab === i ? "text-primary" : "text-on-surface-variant"}`}>
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }
        @keyframes auroraShift {
          0%   { transform: translate(0,0) scale(1);   background: radial-gradient(circle at 30% 30%, #9dcbfc, transparent 70%); }
          50%  { transform: translate(20px,15px) scale(1.15); background: radial-gradient(circle at 60% 50%, #6aa6e8, transparent 70%); }
          100% { transform: translate(0,0) scale(1);   background: radial-gradient(circle at 30% 30%, #9dcbfc, transparent 70%); }
        }
        @keyframes auroraShift2 {
          0%   { transform: translate(0,0) scale(1);   background: radial-gradient(circle at 40% 60%, #d5bbfd, transparent 70%); }
          50%  { transform: translate(-25px,-10px) scale(1.2); background: radial-gradient(circle at 50% 40%, #b18bf0, transparent 70%); }
          100% { transform: translate(0,0) scale(1);   background: radial-gradient(circle at 40% 60%, #d5bbfd, transparent 70%); }
        }
        .aurora  { animation: auroraShift 14s ease-in-out infinite; }
        .aurora-2{ animation: auroraShift2 18s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .aurora, .aurora-2 { animation: none; } }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        input[type=date]::-webkit-calendar-picker-indicator { filter:invert(0.6); }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#0a141e; }
        ::-webkit-scrollbar-thumb { background:#2c3641; border-radius:4px; }
      `}</style>
    </div>
  );
}
