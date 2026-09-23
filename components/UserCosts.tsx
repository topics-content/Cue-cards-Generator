"use client";
import { CardLink } from "@/components/CardLink";
import { Fragment, useMemo, useState } from "react";
import { dayKey, lastNDays, userCosts, userCostsCsv, type DeckStat, type UserInfo } from "@/lib/admin-stats";
import { inr, usd } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

type Preset = "7d" | "30d" | "custom";

const card = "rounded-xl border border-line bg-surface";
const input =
  "rounded-lg border border-line bg-surface px-2 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
const th = "px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted";

const fmtDay = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function UserCosts({ decks, users, rate, canOpen }: { decks: DeckStat[]; users: UserInfo[]; rate: number; canOpen: (d: DeckStat) => boolean }) {
  const [preset, setPreset] = useState<Preset>("30d");
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});
  const [open, setOpen] = useState<string | null>(null);

  const range = useMemo(
    () => (preset === "7d" ? lastNDays(7) : preset === "30d" ? lastNDays(30) : custom),
    [preset, custom],
  );
  const rows = useMemo(() => userCosts(decks, users, range), [decks, users, range]);
  const totalUsd = rows.reduce((n, u) => n + u.costUsd, 0);
  const totalCards = rows.reduce((n, u) => n + u.decks, 0);
  const customInvalid = preset === "custom" && !!custom.from && !!custom.to && custom.from > custom.to;

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([userCostsCsv(rows, rate)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `user-costs-${range.from ?? "start"}-to-${range.to ?? "today"}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  const periodLabel =
    range.from || range.to
      ? `${range.from ? fmtDay(range.from) : "the beginning"} – ${range.to ? fmtDay(range.to) : "today"}`
      : "all time";

  return (
    <section aria-label="User wise costs">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">User wise costs</h2>
          <p className="mt-0.5 text-sm text-muted">Cost of the cue cards each person created · {periodLabel} (India time)</p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div role="group" aria-label="Period" className="inline-flex overflow-hidden rounded-lg border border-line text-sm font-medium">
            {([["7d", "7D"], ["30d", "30D"], ["custom", "Date range"]] as const).map(([k, t]) => (
              <button
                key={k}
                type="button"
                aria-pressed={preset === k}
                onClick={() => setPreset(k)}
                className={`px-4 py-2 transition ${preset === k ? "bg-primary text-primary-fg" : "text-muted hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted">From
                <input type="date" className={input} value={custom.from ?? ""} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value || undefined }))} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">To
                <input type="date" className={input} value={custom.to ?? ""} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value || undefined }))} />
              </label>
            </>
          )}
          <button type="button" className={`${input} font-medium`} onClick={exportCsv} disabled={rows.length === 0}>Export CSV</button>
        </div>
      </div>

      {customInvalid && (
        <p role="alert" className="mb-4 rounded-lg border border-warn bg-warn-soft px-4 py-2 text-sm text-warn">⚠ The start date is after the end date.</p>
      )}

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className={`${th} text-left`}>User</th>
              <th scope="col" className={`${th} text-left`}>Email</th>
              <th scope="col" className={`${th} text-right`}>Cue cards</th>
              <th scope="col" className={`${th} text-right`}>Cost USD</th>
              <th scope="col" className={`${th} text-right`}>Cost INR</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No cue cards were created in this period.</td></tr>
            )}
            {rows.map((u) => (
              <Fragment key={u.email}>
                <tr className="border-b border-line hover:bg-background">
                  <td className="px-4 py-2 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-left"
                      aria-expanded={open === u.email}
                      onClick={() => setOpen((o) => (o === u.email ? null : u.email))}
                    >
                      <span aria-hidden className={`inline-block text-muted transition ${open === u.email ? "rotate-90" : ""}`}>▸</span>
                      {u.name}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-muted">{u.email}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{u.decks}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{usd(u.costUsd)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{inr(u.costUsd, rate)}</td>
                </tr>
                {open === u.email && (
                  <tr className="border-b border-line bg-background">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="space-y-4">
                        {u.programs.map((p) => (
                          <div key={p.program}>
                            <p className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2 text-sm font-semibold">
                              <span>{p.program} <span className="font-normal text-muted">· {p.decks} cue card{p.decks === 1 ? "" : "s"}</span></span>
                              <span className="tabular-nums">{usd(p.costUsd)} <span className="font-normal text-muted">· {inr(p.costUsd, rate)}</span></span>
                            </p>
                            <ul>
                              {p.cards.map((c) => (
                                <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm">
                                  <span className="min-w-0">
                                    <CardLink id={c.id} canOpen={canOpen(c)}>{c.className}</CardLink>
                                    <span className="text-muted"> · {c.module} · {fmtDay(dayKey(c.createdAt))}</span>
                                    {c.status !== "done" && <span className="ml-2"><StatusPill status={c.status} /></span>}
                                  </span>
                                  <span className="tabular-nums">{usd(c.costUsd)} <span className="text-muted">· {inr(c.costUsd, rate)}</span></span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-line bg-background font-medium">
              <tr>
                <td className="px-4 py-4" colSpan={2}>Total ({rows.length} user{rows.length === 1 ? "" : "s"})</td>
                <td className="px-4 py-4 text-right tabular-nums">{totalCards}</td>
                <td className="px-4 py-4 text-right tabular-nums">{usd(totalUsd)}</td>
                <td className="px-4 py-4 text-right tabular-nums">{inr(totalUsd, rate)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
