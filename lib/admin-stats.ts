// Pure aggregation over deck rows. Everything on the Admin Panel derives from the same rows,
// so the monthly chart, KPIs, tree and table can never disagree with each other.

export type DeckStat = {
  id: string;
  program: string;
  module: string;
  moduleNormalized: string;
  className: string;
  createdBy: string;
  createdAt: string; // ISO
  status: "pending" | "done" | "failed" | "budget_exceeded";
  /** Has a person run the (LLM-free) cue card validator against this deck's output and confirmed it's clean. */
  reviewStatus: "draft" | "completed";
  /** Spend cap tier reached: 0 = first cap, higher = the user continued past a cap. */
  tier: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cachedPct: number;
  costUsd: number;
};

const TZ = "Asia/Kolkata";

/** "YYYY-MM" of a moment in India time. */
export function monthKey(d: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" })
    .formatToParts(new Date(d));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}`;
}

const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Paused at a cap right now, or was continued past one earlier. */
export const hitCap = (r: DeckStat) => r.status === "budget_exceeded" || r.tier > 0;

const sum = (rows: DeckStat[]) => rows.reduce((n, r) => n + r.costUsd, 0);

export function kpis(rows: DeckStat[], now = new Date()) {
  const cur = monthKey(now);
  const prev = shiftMonth(cur, -1);
  const thisMonth = rows.filter((r) => monthKey(r.createdAt) === cur);
  const lastMonthCost = sum(rows.filter((r) => monthKey(r.createdAt) === prev));
  const total = sum(rows);
  const monthCost = sum(thisMonth);
  return {
    totalCostUsd: total,
    monthCostUsd: monthCost,
    monthChangePct: lastMonthCost > 0 ? ((monthCost - lastMonthCost) / lastMonthCost) * 100 : null,
    deckCount: rows.length,
    avgCostUsd: rows.length ? total / rows.length : 0,
    overBudgetThisMonth: thisMonth.filter(hitCap).length,
  };
}

/** Last `n` calendar months (oldest first), zero-filled so gaps are visible. */
export function monthlySeries(rows: DeckStat[], now = new Date(), n = 12) {
  const cur = monthKey(now);
  const buckets = new Map<string, { costUsd: number; decks: number }>();
  for (let i = n - 1; i >= 0; i--) buckets.set(shiftMonth(cur, -i), { costUsd: 0, decks: 0 });
  for (const r of rows) {
    const b = buckets.get(monthKey(r.createdAt));
    if (b) {
      b.costUsd += r.costUsd;
      b.decks += 1;
    }
  }
  return [...buckets].map(([month, v]) => {
    const [y, m] = month.split("-").map(Number);
    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
    return { month, label, ...v };
  });
}

export function byProgram(rows: DeckStat[]) {
  const m = new Map<string, { program: string; costUsd: number; decks: number }>();
  for (const r of rows) {
    const e = m.get(r.program) ?? { program: r.program, costUsd: 0, decks: 0 };
    e.costUsd += r.costUsd;
    e.decks += 1;
    m.set(r.program, e);
  }
  return [...m.values()].sort((a, b) => b.costUsd - a.costUsd);
}

export type TreeModule = { module: string; costUsd: number; decks: number; classes: DeckStat[] };
export type TreeProgram = { program: string; costUsd: number; decks: number; modules: TreeModule[] };

/** Program ▸ Module ▸ Class, every level sorted by cost descending. */
export function moduleTree(rows: DeckStat[]): TreeProgram[] {
  const programs = new Map<string, Map<string, TreeModule>>();
  for (const r of [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const mods = programs.get(r.program) ?? new Map<string, TreeModule>();
    // First one seen is the newest, so its spelling is the display name.
    const mod = mods.get(r.moduleNormalized) ?? { module: r.module, costUsd: 0, decks: 0, classes: [] };
    mod.costUsd += r.costUsd;
    mod.decks += 1;
    mod.classes.push(r);
    mods.set(r.moduleNormalized, mod);
    programs.set(r.program, mods);
  }
  return [...programs]
    .map(([program, mods]) => {
      const modules = [...mods.values()].sort((a, b) => b.costUsd - a.costUsd);
      for (const m of modules) m.classes.sort((a, b) => b.costUsd - a.costUsd);
      return { program, modules, costUsd: modules.reduce((n, m) => n + m.costUsd, 0), decks: modules.reduce((n, m) => n + m.decks, 0) };
    })
    .sort((a, b) => b.costUsd - a.costUsd);
}

export type Filters = {
  from?: string; // yyyy-mm-dd, India time, inclusive
  to?: string;
  program?: string;
  module?: string; // normalized
  creator?: string;
  overBudgetOnly?: boolean;
};

export const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso)); // yyyy-mm-dd

export function filterRows(rows: DeckStat[], f: Filters): DeckStat[] {
  return rows.filter(
    (r) =>
      (!f.from || dayKey(r.createdAt) >= f.from) &&
      (!f.to || dayKey(r.createdAt) <= f.to) &&
      (!f.program || r.program === f.program) &&
      (!f.module || r.moduleNormalized === f.module) &&
      (!f.creator || r.createdBy === f.creator) &&
      (!f.overBudgetOnly || hitCap(r)),
  );
}

export type SortKey =
  | "program" | "module" | "className" | "createdBy" | "createdAt"
  | "tokens" | "cachedPct" | "costUsd" | "budget";

export function sortRows(rows: DeckStat[], key: SortKey, dir: "asc" | "desc"): DeckStat[] {
  const val = (r: DeckStat): string | number => {
    switch (key) {
      case "tokens": return r.inputTokens + r.outputTokens;
      case "budget": return r.costUsd;
      default: return r[key];
    }
  };
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sign;
  });
}

export function totals(rows: DeckStat[]) {
  const input = rows.reduce((n, r) => n + r.inputTokens, 0);
  const cached = rows.reduce((n, r) => n + r.cachedTokens, 0);
  return {
    decks: rows.length,
    inputTokens: input,
    outputTokens: rows.reduce((n, r) => n + r.outputTokens, 0),
    cachedPct: input ? (cached / input) * 100 : 0,
    costUsd: sum(rows),
  };
}

export type BudgetLevel = "ok" | "warn" | "over" | "stopped";
export function budgetUsed(r: DeckStat, budget: number): { pct: number; level: BudgetLevel } {
  const pct = budget > 0 ? (r.costUsd / budget) * 100 : 0;
  const level: BudgetLevel =
    r.status === "budget_exceeded" ? "stopped" : r.tier > 0 || pct > 100 ? "over" : pct >= 70 ? "warn" : "ok";
  return { pct, level };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  // Quote anything with separators/quotes/newlines; neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(s) && typeof v === "string" ? "'" + s : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(rows: DeckStat[], inrRate: number, budget: number): string {
  const head = ["Program","Module","Class Name","Created by","Date (IST)","Status","Tokens in","Tokens out","Cached %","Cost USD","Cost INR","Budget used %"];
  const lines = rows.map((r) =>
    [
      r.program, r.module, r.className, r.createdBy, dayKey(r.createdAt), r.status,
      r.inputTokens, r.outputTokens, r.cachedPct.toFixed(1),
      r.costUsd.toFixed(6), (r.costUsd * inrRate).toFixed(2), budgetUsed(r, budget).pct.toFixed(1),
    ].map(csvCell).join(","),
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}

/** Inclusive yyyy-mm-dd range (India time) covering the last `n` days, today included. */
export function lastNDays(n: number, now = new Date()): { from: string; to: string } {
  const to = dayKey(now.toISOString());
  const d = new Date(to + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - (n - 1));
  return { from: d.toISOString().slice(0, 10), to };
}

export type UserInfo = { email: string; name: string | null };
export type UserCost = {
  email: string;
  name: string;
  costUsd: number;
  decks: number;
  programs: { program: string; costUsd: number; decks: number; cards: DeckStat[] }[];
};

/** Cost per creator within [from, to], each with their cue cards grouped by Program. Highest cost first. */
export function userCosts(rows: DeckStat[], users: UserInfo[], range: { from?: string; to?: string }): UserCost[] {
  const names = new Map(users.map((u) => [u.email, u.name]));
  const byUser = new Map<string, DeckStat[]>();
  for (const r of filterRows(rows, range)) byUser.set(r.createdBy, [...(byUser.get(r.createdBy) ?? []), r]);

  return [...byUser]
    .map(([email, list]) => {
      const progs = new Map<string, DeckStat[]>();
      for (const r of list) progs.set(r.program, [...(progs.get(r.program) ?? []), r]);
      const programs = [...progs]
        .map(([program, cards]) => ({
          program,
          cards: [...cards].sort((a, b) => b.costUsd - a.costUsd),
          costUsd: sum(cards),
          decks: cards.length,
        }))
        .sort((a, b) => b.costUsd - a.costUsd);
      return { email, name: names.get(email) || email.split("@")[0], costUsd: sum(list), decks: list.length, programs };
    })
    .sort((a, b) => b.costUsd - a.costUsd);
}

export function userCostsCsv(users: UserCost[], inrRate: number): string {
  const head = ["User","Email","Program","Module","Class Name","Date (IST)","Cost USD","Cost INR"];
  const lines = users.flatMap((u) =>
    u.programs.flatMap((p) =>
      p.cards.map((c) =>
        [u.name, u.email, p.program, c.module, c.className, dayKey(c.createdAt), c.costUsd.toFixed(6), (c.costUsd * inrRate).toFixed(2)]
          .map(csvCell).join(","),
      ),
    ),
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}
