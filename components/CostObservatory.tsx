"use client";
import Link from "next/link";
import { CardLink } from "@/components/CardLink";
import { Spinner } from "@/components/Spinner";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  budgetUsed, byProgram, durationMs, filterRows, kpis, monthlySeries, moduleTree, sortRows, toCsv, totals,
  type DeckStat, type Filters, type SortKey, type UserInfo,
} from "@/lib/admin-stats";
import { inr, longDuration, tokens, usd } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { UserCosts } from "@/components/UserCosts";

type Data = { decks: DeckStat[]; users: UserInfo[]; viewer: { email: string; isAdmin: boolean }; budget: number; inrRate: number };
type Gen = {
  id: string; section_index: number; pass: number; model: string; input_tokens: number; output_tokens: number;
  cached_tokens: number; cost_usd: number; reconciled: boolean;
};

const card = "rounded-xl border border-line bg-surface";
const input =
  "rounded-lg border border-line bg-surface px-2 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
const MARK = "var(--primary)";
const AXIS = { fontSize: 12, fill: "var(--muted)" };

type TipProps = { active?: boolean; payload?: readonly { value?: unknown }[]; label?: string | number };
const tip = (fmt: (v: number) => string, noun: string) =>
  function Tip({ active, payload, label }: TipProps) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-line bg-surface px-4 py-2 text-xs shadow-md">
        <p className="text-muted">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-foreground">{fmt(Number(payload[0].value))} <span className="font-normal text-muted">{noun}</span></p>
      </div>
    );
  };

function ChartCard({ title, children, right, summary }: { title: string; children: React.ReactNode; right?: React.ReactNode; summary: string }) {
  return (
    <section className={`${card} p-4`} aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {right}
      </div>
      <div className="h-56" role="img" aria-label={summary}>{children}</div>
    </section>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function BudgetCell({ d, budget }: { d: DeckStat; budget: number }) {
  const { pct, level } = budgetUsed(d, budget);
  const color = level === "stopped" || level === "over" ? "bg-danger" : level === "warn" ? "bg-warn" : "bg-primary";
  const text = level === "stopped" || level === "over" ? "text-danger" : level === "warn" ? "text-warn" : "text-foreground";
  return (
    <div className="min-w-[110px]">
      <div className={`flex items-center justify-between text-xs tabular-nums ${text}`}>
        <span>{Math.min(pct, 999).toFixed(0)}%</span>
        <span>{level === "stopped" ? "⛔ Paused at cap" : level === "over" ? "▲ Over cap" : level === "warn" ? "⚠ Near cap" : ""}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

const COLS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "program", label: "Program" },
  { key: "module", label: "Module" },
  { key: "className", label: "Class Name" },
  { key: "createdBy", label: "Created by" },
  { key: "createdAt", label: "Date" },
  { key: "duration", label: "Time taken", right: true },
  { key: "tokens", label: "Tokens in/out", right: true },
  { key: "cachedPct", label: "Cached %", right: true },
  { key: "costUsd", label: "Cost USD", right: true },
];

export function CostObservatory() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "createdAt", dir: "desc" });
  const [open, setOpen] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [gens, setGens] = useState<Record<string, Gen[] | "loading" | "error">>({});

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch("/api/observatory", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load cost data.");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load cost data.");
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const decks = data?.decks;
  const rate = data?.inrRate ?? 95;
  const budget = data?.budget ?? 3;
  const k = useMemo(() => (decks ? kpis(decks) : null), [decks]);
  const monthly = useMemo(() => (decks ? monthlySeries(decks) : []), [decks]);
  const programs = useMemo(() => (decks ? byProgram(decks) : []), [decks]);
  const tree = useMemo(() => (decks ? moduleTree(decks) : []), [decks]);
  const filtered = useMemo(() => (decks ? sortRows(filterRows(decks, filters), sort.key, sort.dir) : []), [decks, filters, sort]);
  const tot = useMemo(() => totals(filtered), [filtered]);

  const moduleOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of decks ?? []) if (!filters.program || d.program === filters.program) m.set(d.moduleNormalized, d.module);
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [decks, filters.program]);
  const creators = useMemo(() => [...new Set((decks ?? []).map((d) => d.createdBy))].sort(), [decks]);

  async function toggle(id: string) {
    setOpen((o) => (o === id ? null : id));
    if (gens[id]) return;
    setGens((g) => ({ ...g, [id]: "loading" }));
    try {
      const res = await fetch(`/api/observatory/${id}/generations`);
      if (!res.ok) throw new Error();
      const { generations } = await res.json();
      setGens((g) => ({ ...g, [id]: generations }));
    } catch {
      setGens((g) => ({ ...g, [id]: "error" }));
    }
  }

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(filtered, rate, budget)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `cue-cards-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-danger bg-danger-soft px-4 py-4 text-sm text-danger">
        {error} <button className="ml-2 underline" onClick={load}>Retry</button>
      </div>
    );
  }
  if (!data || !k) {
    return (
      <div role="status" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-muted">
        <Spinner className="h-8 w-8 text-primary" />
        <span className="text-sm">Loading cost data…</span>
      </div>
    );
  }
  // Cost data is open to everyone; opening a cue card is limited to its creator or an admin.
  const canOpen = (d: DeckStat) => data.viewer.isAdmin || d.createdBy === data.viewer.email;

  const money = (v: number) => (currency === "USD" ? usd(v) : inr(v, 1));
  const monthData = monthly.map((m) => ({ ...m, value: currency === "USD" ? m.costUsd : m.costUsd * rate }));
  const change = k.monthChangePct;
  const th = "px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted";

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cost Observatory</h1>
          <p className="mt-1 text-sm text-muted">LLM cost across all cue cards. OpenRouter&apos;s reported cost is the source of truth. INR at ₹{rate}/USD.</p>
        </div>
        <button className={`${input} inline-flex items-center gap-2 font-medium disabled:opacity-60`} onClick={load} disabled={refreshing}>{refreshing && <Spinner className="h-4 w-4" />}{refreshing ? "Refreshing…" : "Refresh"}</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Total LLM cost" value={usd(k.totalCostUsd)} sub={inr(k.totalCostUsd, rate)} />
        <Kpi
          title="This month"
          value={usd(k.monthCostUsd)}
          sub={<>{inr(k.monthCostUsd, rate)} · {change == null ? "no data last month" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(0)}% vs last month`}</>}
        />
        <Kpi title="Total cue cards" value={String(k.deckCount)} />
        <Kpi title="Avg cost per class" value={usd(k.avgCostUsd)} sub={inr(k.avgCostUsd, rate)} />
        <Kpi title="Cue cards over budget" value={String(k.overBudgetThisMonth)} sub={`hit the ${usd(budget)} cap this month`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Monthly cost"
          summary={`Monthly LLM cost for the last 12 months. Latest month: ${money(monthData[monthData.length - 1]?.value ?? 0)}.`}
          right={
            <div role="group" aria-label="Currency" className="inline-flex overflow-hidden rounded-lg border border-line text-xs font-medium">
              {(["USD", "INR"] as const).map((c) => (
                <button key={c} aria-pressed={currency === c} onClick={() => setCurrency(c)} className={`px-2 py-1 ${currency === c ? "bg-primary text-primary-fg" : "text-muted hover:text-foreground"}`}>{c}</button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (currency === "USD" ? `$${v}` : `₹${v}`)} />
              <Tooltip cursor={{ fill: "var(--line)", opacity: 0.4 }} content={tip(money, "")} />
              <Bar dataKey="value" fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cue cards per month" summary={`Number of cue cards created per month for the last 12 months. Latest month: ${monthly[monthly.length - 1]?.decks ?? 0}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <Tooltip cursor={{ stroke: "var(--line)" }} content={tip((v) => String(v), "cue cards")} />
              <Line type="linear" dataKey="decks" stroke={MARK} strokeWidth={2} dot={{ r: 4, fill: MARK, stroke: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard title="Cost by Program" summary={`Total cost by program: ${programs.map((p) => `${p.program} ${usd(p.costUsd)}`).join(", ") || "no data"}.`}>
            {programs.length === 0 ? (
              <p className="pt-16 text-center text-sm text-muted">No cue cards yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={programs.map((p) => ({ ...p, label: p.program, value: currency === "USD" ? p.costUsd : p.costUsd * rate }))} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid horizontal={false} stroke="var(--line)" />
                  <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => (currency === "USD" ? `$${v}` : `₹${v}`)} />
                  <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={72} />
                  <Tooltip cursor={{ fill: "var(--line)", opacity: 0.4 }} content={tip(money, "")} />
                  <Bar dataKey="value" fill={MARK} radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>

      <section aria-label="Module breakdown">
        <h2 className="mb-4 text-lg font-semibold">Module breakdown</h2>
        {tree.length === 0 ? <p className="text-sm text-muted">No cue cards yet.</p> : (
          <div className={`${card} divide-y divide-line`}>
            {tree.map((p, pi) => (
              <details key={p.program} open={pi === 0} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 font-medium hover:bg-background">
                  <span><span className="mr-2 inline-block text-muted transition group-open:rotate-90">▸</span>{p.program}</span>
                  <span className="text-sm tabular-nums">{p.decks} cue card{p.decks === 1 ? "" : "s"} · {inr(p.costUsd, rate)} <span className="text-muted">({usd(p.costUsd)})</span></span>
                </summary>
                <div className="border-t border-line bg-background/50">
                  {p.modules.map((m) => (
                    <details key={m.module} className="group/m">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-2 pl-9 text-sm hover:bg-background">
                        <span><span className="mr-2 inline-block text-muted transition group-open/m:rotate-90">▸</span>{m.module}</span>
                        <span className="tabular-nums">{m.decks} cue card{m.decks === 1 ? "" : "s"} · {inr(m.costUsd, rate)}</span>
                      </summary>
                      <ul className="pb-2">
                        {m.classes.map((c) => (
                          <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 pl-16 text-sm">
                            <CardLink id={c.id} canOpen={canOpen(c)}>{c.className}</CardLink>
                            <span className="text-xs tabular-nums text-muted">
                              {inr(c.costUsd, rate)} · {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} · {c.createdBy}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <UserCosts decks={data.decks} users={data.users ?? []} rate={rate} canOpen={canOpen} />

      <section aria-label="All cue cards">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">All cue cards <span className="text-sm font-normal text-muted">({filtered.length})</span></h2>
          <button className={`${input} font-medium`} onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</button>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-4 text-xs text-muted">
          <label className="flex flex-col gap-1">From<input type="date" className={input} value={filters.from ?? ""} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))} /></label>
          <label className="flex flex-col gap-1">To<input type="date" className={input} value={filters.to ?? ""} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))} /></label>
          <label className="flex flex-col gap-1">Program
            <select className={input} value={filters.program ?? ""} onChange={(e) => setFilters((f) => ({ ...f, program: e.target.value || undefined, module: undefined }))}>
              <option value="">All</option>{programs.map((p) => <option key={p.program}>{p.program}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Module
            <select className={input} value={filters.module ?? ""} onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value || undefined }))}>
              <option value="">All</option>{moduleOptions.map(([norm, name]) => <option key={norm} value={norm}>{name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Creator
            <select className={input} value={filters.creator ?? ""} onChange={(e) => setFilters((f) => ({ ...f, creator: e.target.value || undefined }))}>
              <option value="">All</option>{creators.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
            <input type="checkbox" checked={!!filters.overBudgetOnly} onChange={(e) => setFilters((f) => ({ ...f, overBudgetOnly: e.target.checked || undefined }))} />
            Over budget only
          </label>
          {Object.values(filters).some(Boolean) && <button className="pb-2 text-sm font-medium text-brand hover:underline" onClick={() => setFilters({})}>Clear filters</button>}
        </div>

        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="border-b border-line">
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`${th} ${c.right ? "text-right" : "text-left"}`}>
                    <button className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === "desc" ? "asc" : "desc" }))}>
                      {c.label}<span aria-hidden>{sort.key === c.key ? (sort.dir === "asc" ? "↑" : "↓") : ""}</span>
                    </button>
                  </th>
                ))}
                <th scope="col" className={`${th} text-right`}>Cost INR</th>
                <th scope="col" aria-sort={sort.key === "budget" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`${th} text-left`}>
                  <button className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground" onClick={() => setSort((s) => ({ key: "budget", dir: s.key === "budget" && s.dir === "desc" ? "asc" : "desc" }))}>Budget used<span aria-hidden>{sort.key === "budget" ? (sort.dir === "asc" ? "↑" : "↓") : ""}</span></button>
                </th>
                <th scope="col" className={th}>View</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={12} className="px-4 py-10 text-center text-muted">No cue cards match these filters.</td></tr>}
              {filtered.map((d) => (
                <Fragment key={d.id}>
                  <tr className="cursor-pointer border-b border-line hover:bg-background" onClick={() => toggle(d.id)} aria-expanded={open === d.id}>
                    <td className="px-4 py-2">{d.program}</td>
                    <td className="px-4 py-2">{d.module}</td>
                    <td className="px-4 py-2 font-medium">
                      <button className="text-left" aria-label={`Toggle cost breakdown for ${d.className}`} onClick={(e) => { e.stopPropagation(); void toggle(d.id); }}>{d.className}</button>
                      {d.status !== "done" && <span className="ml-2"><StatusPill status={d.status} /></span>}
                    </td>
                    <td className="px-4 py-2 text-muted">{d.createdBy}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted">{new Date(d.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{durationMs(d) != null ? longDuration(durationMs(d)!) : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{tokens(d.inputTokens)} / {tokens(d.outputTokens)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.cachedPct.toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{usd(d.costUsd)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{inr(d.costUsd, rate)}</td>
                    <td className="px-4 py-2"><BudgetCell d={d} budget={budget} /></td>
                    <td className="px-4 py-2">{canOpen(d) ? <Link href={`/decks/${d.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-brand hover:underline">View</Link> : <span className="text-muted" title="Only the creator or an admin can open this">Private</span>}</td>
                  </tr>
                  {open === d.id && (
                    <tr className="border-b border-line bg-background">
                      <td colSpan={12} className="px-6 py-4">
                        {gens[d.id] === "loading" && <p className="flex items-center gap-2 text-muted" role="status"><Spinner /> Loading breakdown…</p>}
                        {gens[d.id] === "error" && <p className="text-danger">Could not load the breakdown.</p>}
                        {Array.isArray(gens[d.id]) && (
                          <table className="w-full max-w-3xl text-xs tabular-nums">
                            <thead className="text-muted"><tr><th className="py-1 text-left font-medium">Section</th><th className="text-left font-medium">Pass</th><th className="text-right font-medium">In</th><th className="text-right font-medium">Out</th><th className="text-right font-medium">Cached</th><th className="text-right font-medium">Cost</th><th className="text-right font-medium">Settled</th></tr></thead>
                            <tbody>
                              {(gens[d.id] as Gen[]).map((g) => (
                                <tr key={g.id} className="border-t border-line">
                                  <td className="py-1">{g.section_index + 1}</td>
                                  <td>{g.pass === 1 ? "1 · Generate" : "2 · Audit"}</td>
                                  <td className="text-right">{tokens(g.input_tokens)}</td>
                                  <td className="text-right">{tokens(g.output_tokens)}</td>
                                  <td className="text-right">{tokens(g.cached_tokens)}</td>
                                  <td className="text-right">{usd(g.cost_usd)}</td>
                                  <td className="text-right">{g.reconciled ? "✓" : "…"}</td>
                                </tr>
                              ))}
                              {(gens[d.id] as Gen[]).length === 0 && <tr><td colSpan={7} className="py-2 text-muted">No LLM calls recorded.</td></tr>}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line bg-background font-medium">
              <tr>
                <td className="px-4 py-4" colSpan={5}>Total ({tot.decks} cue card{tot.decks === 1 ? "" : "s"})</td>
                <td className="px-4 py-4 text-right tabular-nums">{tokens(tot.inputTokens)} / {tokens(tot.outputTokens)}</td>
                <td className="px-4 py-4 text-right tabular-nums">{tot.cachedPct.toFixed(0)}%</td>
                <td className="px-4 py-4 text-right tabular-nums">{usd(tot.costUsd)}</td>
                <td className="px-4 py-4 text-right tabular-nums">{inr(tot.costUsd, rate)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
