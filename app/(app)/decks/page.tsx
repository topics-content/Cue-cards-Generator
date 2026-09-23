import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { durationMs, totals } from "@/lib/admin-stats";
import { getUser } from "@/lib/auth";
import { inr, longDuration, usd } from "@/lib/format";
import { deckStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MyDecks() {
  const user = await getUser();
  if (!user) return null;
  const rate = Number(process.env.INR_RATE ?? 95);
  // Admins see every cue card, not just their own — everyone else is scoped to what they created.
  const decks = await deckStats(user.isAdmin ? undefined : user.email);
  const t = totals(decks);
  const th = "px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted";

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user.isAdmin ? "All cue cards" : "My cue cards"}</h1>
          <p className="mt-1 text-sm text-muted">
            {t.decks} cue card{t.decks === 1 ? "" : "s"} · {usd(t.costUsd)} <span aria-hidden>·</span> {inr(t.costUsd, rate)} total
          </p>
        </div>
        <Link href="/" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition hover:bg-primary-hover">New cue cards</Link>
      </div>

      {decks.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">No cue cards yet</p>
          <p className="mt-1 text-sm text-muted">Upload a script to generate your first cue cards.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Program</th><th className={th}>Module</th><th className={th}>Class</th>
                {user.isAdmin && <th className={th}>Created by</th>}
                <th className={th}>Date</th><th className={th}>Time taken</th><th className={th}>Status</th><th className={th}>Review</th>
                <th className={`${th} text-right`}>Cost</th><th className={th}><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {decks.map((d) => {
                const ms = durationMs(d);
                return (
                  <tr key={d.id} className="border-b border-line last:border-0 hover:bg-background">
                    <td className="px-4 py-4">{d.program}</td>
                    <td className="px-4 py-4">{d.module}</td>
                    <td className="px-4 py-4 font-medium">{d.className}</td>
                    {user.isAdmin && <td className="px-4 py-4 text-muted">{d.createdBy}</td>}
                    <td className="px-4 py-4 whitespace-nowrap text-muted">{new Date(d.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-muted">{ms != null ? longDuration(ms) : "—"}</td>
                    <td className="px-4 py-4"><StatusPill status={d.status} /></td>
                    <td className="px-4 py-4">
                      <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${d.reviewStatus === "completed" ? "bg-ok-soft text-ok" : "bg-line text-muted"}`}>
                        {d.reviewStatus === "completed" ? "✓ Verified" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">{usd(d.costUsd)} <span className="text-muted">· {inr(d.costUsd, rate)}</span></td>
                    <td className="px-4 py-4 text-right"><Link className="font-medium text-brand hover:underline" href={`/decks/${d.id}`}>View</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
