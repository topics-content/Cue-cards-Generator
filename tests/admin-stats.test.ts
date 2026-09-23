import { describe, expect, it } from "vitest";
import {
  budgetUsed, filterRows, kpis, lastNDays, monthKey, monthlySeries, moduleTree, sortRows, toCsv, totals, userCosts, userCostsCsv,
  type DeckStat,
} from "@/lib/admin-stats";

let n = 0;
const deck = (o: Partial<DeckStat> = {}): DeckStat => ({
  id: String(++n), program: "DSML", module: "SQL", moduleNormalized: "sql", className: "Class " + n,
  createdBy: "a@scaler.com", createdAt: "2026-09-10T10:00:00Z", status: "done", reviewStatus: "draft", tier: 0,
  inputTokens: 1000, outputTokens: 500, cachedTokens: 800, cachedPct: 80, costUsd: 0.5, ...o,
});
const NOW = new Date("2026-09-21T12:00:00Z");

describe("months are India-time calendar months", () => {
  it("puts 20:00 UTC on the 30th into the next IST month", () => {
    expect(monthKey("2026-09-30T20:00:00Z")).toBe("2026-10"); // 01:30 IST on 1 Oct
    expect(monthKey("2026-09-30T18:00:00Z")).toBe("2026-09");
  });
});

describe("monthlySeries", () => {
  const rows = [
    deck({ createdAt: "2026-09-02T00:00:00Z", costUsd: 1.25 }),
    deck({ createdAt: "2026-09-15T00:00:00Z", costUsd: 0.75 }),
    deck({ createdAt: "2026-07-05T00:00:00Z", costUsd: 2 }),
    deck({ createdAt: "2025-01-05T00:00:00Z", costUsd: 9 }), // outside the 12 months
  ];
  const s = monthlySeries(rows, NOW);

  it("returns 12 zero-filled months, oldest first, ending at the current month", () => {
    expect(s).toHaveLength(12);
    expect(s[11].month).toBe("2026-09");
    expect(s[0].month).toBe("2025-10");
    expect(s.find((m) => m.month === "2026-08")!.costUsd).toBe(0);
  });

  it("chart totals equal the sum of that month's deck costs", () => {
    expect(s.find((m) => m.month === "2026-09")).toMatchObject({ costUsd: 2, decks: 2 });
    expect(s.reduce((a, m) => a + m.costUsd, 0)).toBe(4);
  });
});

describe("kpis", () => {
  it("computes month-over-month change and the over-budget count for this month only", () => {
    const rows = [
      deck({ createdAt: "2026-09-02T00:00:00Z", costUsd: 3, status: "budget_exceeded" }),
      deck({ createdAt: "2026-08-02T00:00:00Z", costUsd: 2, status: "budget_exceeded" }),
      deck({ createdAt: "2026-08-03T00:00:00Z", costUsd: 2 }),
    ];
    const k = kpis(rows, NOW);
    expect(k.totalCostUsd).toBe(7);
    expect(k.monthChangePct).toBeCloseTo(-25);
    expect(k.overBudgetThisMonth).toBe(1);
    // a deck that was continued past the cap still counts, even though it finished
    expect(kpis([...rows, deck({ createdAt: "2026-09-03T00:00:00Z", tier: 1, costUsd: 4 })], NOW).overBudgetThisMonth).toBe(2);
    expect(k.avgCostUsd).toBeCloseTo(7 / 3);
  });
  it("has no percentage change when last month was zero", () => {
    expect(kpis([deck({ createdAt: "2026-09-02T00:00:00Z" })], NOW).monthChangePct).toBeNull();
  });
});

describe("moduleTree", () => {
  it("merges module spellings and sorts by cost descending at every level", () => {
    const rows = [
      deck({ module: "React Basics", moduleNormalized: "react basics", costUsd: 1, createdAt: "2026-09-01T00:00:00Z" }),
      deck({ module: "react basics", moduleNormalized: "react basics", costUsd: 2, createdAt: "2026-09-05T00:00:00Z" }),
      deck({ module: "SQL", moduleNormalized: "sql", costUsd: 2.5 }),
      deck({ program: "AIML", module: "NLP", moduleNormalized: "nlp", costUsd: 0.1 }),
    ];
    const t = moduleTree(rows);
    expect(t.map((p) => p.program)).toEqual(["DSML", "AIML"]);
    expect(t[0].modules.map((m) => [m.module, m.decks, m.costUsd])).toEqual([
      ["react basics", 2, 3], // newest spelling wins
      ["SQL", 1, 2.5],
    ]);
    expect(t[0].modules[0].classes[0].costUsd).toBe(2);
  });
});

describe("filters, sorting, totals", () => {
  const rows = [
    deck({ program: "DSML", costUsd: 1, createdAt: "2026-09-01T00:00:00Z" }),
    deck({ program: "AIML", costUsd: 3, status: "budget_exceeded", createdAt: "2026-09-10T00:00:00Z", createdBy: "b@scaler.com" }),
  ];
  it("filters by every field and totals reflect the filter", () => {
    expect(filterRows(rows, { program: "AIML" })).toHaveLength(1);
    expect(filterRows(rows, { overBudgetOnly: true })[0].createdBy).toBe("b@scaler.com");
    expect(filterRows(rows, { from: "2026-09-05" })).toHaveLength(1);
    expect(filterRows(rows, { to: "2026-09-05" })).toHaveLength(1);
    expect(filterRows(rows, { creator: "a@scaler.com" })).toHaveLength(1);
    expect(totals(filterRows(rows, { program: "AIML" })).costUsd).toBe(3);
  });
  it("sorts both ways", () => {
    expect(sortRows(rows, "costUsd", "desc")[0].costUsd).toBe(3);
    expect(sortRows(rows, "program", "asc")[0].program).toBe("AIML");
  });
  it("budget used: amber from 70%, stopped when the cap was hit", () => {
    expect(budgetUsed(deck({ costUsd: 1 }), 3).level).toBe("ok");
    expect(budgetUsed(deck({ costUsd: 2.2 }), 3).level).toBe("warn");
    expect(budgetUsed(deck({ costUsd: 2.9, status: "budget_exceeded" }), 3).level).toBe("stopped");
    // continued past the first cap: over, even after finishing
    expect(budgetUsed(deck({ costUsd: 4.2, tier: 1 }), 3).level).toBe("over");
    expect(budgetUsed(deck({ costUsd: 3.4 }), 3).level).toBe("over");
  });
});

describe("toCsv", () => {
  it("quotes commas and defuses spreadsheet formulas", () => {
    const csv = toCsv([deck({ className: '=HYPERLINK("x"), evil', costUsd: 0.5 })], 95, 3);
    const line = csv.split("\n")[1];
    expect(line).toContain(`"'=HYPERLINK(""x""), evil"`);
    expect(line).toContain("0.500000,47.50,16.7");
  });
});

describe("lastNDays", () => {
  it("is inclusive of today, in India time", () => {
    expect(lastNDays(7, new Date("2026-09-21T12:00:00Z"))).toEqual({ from: "2026-09-15", to: "2026-09-21" });
    // 20:00 UTC on the 21st is already the 22nd in IST
    expect(lastNDays(1, new Date("2026-09-21T20:00:00Z"))).toEqual({ from: "2026-09-22", to: "2026-09-22" });
    expect(lastNDays(30, new Date("2026-03-05T00:00:00Z")).from).toBe("2026-02-04");
  });
});

describe("userCosts", () => {
  const users = [{ email: "a@scaler.com", name: "Asha Rao" }, { email: "b@scaler.com", name: null }];
  const rows = [
    deck({ createdBy: "a@scaler.com", program: "DSML", costUsd: 1, createdAt: "2026-09-20T05:00:00Z", className: "SQL 1" }),
    deck({ createdBy: "a@scaler.com", program: "DSML", costUsd: 2, createdAt: "2026-09-19T05:00:00Z", className: "SQL 2" }),
    deck({ createdBy: "a@scaler.com", program: "AIML", costUsd: 0.5, createdAt: "2026-09-18T05:00:00Z" }),
    deck({ createdBy: "b@scaler.com", program: "FDE", costUsd: 4, createdAt: "2026-09-10T05:00:00Z" }),
    deck({ createdBy: "a@scaler.com", program: "DSML", costUsd: 9, createdAt: "2026-06-01T05:00:00Z" }), // outside
  ];

  it("totals per user inside the period, highest first, with names and email fallbacks", () => {
    const u = userCosts(rows, users, { from: "2026-09-01", to: "2026-09-21" });
    expect(u.map((x) => [x.name, x.email, x.costUsd, x.decks])).toEqual([
      ["b", "b@scaler.com", 4, 1], // no name on file -> local part
      ["Asha Rao", "a@scaler.com", 3.5, 3],
    ]);
  });

  it("groups each user's cue cards by Program, highest cost first, with per-card costs", () => {
    const [, asha] = userCosts(rows, users, { from: "2026-09-01", to: "2026-09-21" });
    expect(asha.programs.map((p) => [p.program, p.costUsd, p.decks])).toEqual([["DSML", 3, 2], ["AIML", 0.5, 1]]);
    expect(asha.programs[0].cards.map((c) => c.className)).toEqual(["SQL 2", "SQL 1"]);
  });

  it("respects the period: a 7 day window drops older cue cards", () => {
    const u = userCosts(rows, users, lastNDays(7, new Date("2026-09-21T12:00:00Z")));
    expect(u).toHaveLength(1);
    expect(u[0].costUsd).toBe(3.5);
  });

  it("period totals add up to the filtered deck costs", () => {
    const range = { from: "2026-09-01", to: "2026-09-21" };
    const total = userCosts(rows, users, range).reduce((n, x) => n + x.costUsd, 0);
    expect(total).toBeCloseTo(filterRows(rows, range).reduce((n, r) => n + r.costUsd, 0));
  });

  it("exports one CSV line per cue card", () => {
    const csv = userCostsCsv(userCosts(rows, users, { from: "2026-09-01", to: "2026-09-21" }), 95);
    expect(csv.trim().split("\n")).toHaveLength(1 + 4);
    expect(csv).toContain("Asha Rao,a@scaler.com,DSML");
  });
});
