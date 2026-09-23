const styles = {
  done: ["bg-ok-soft text-ok", "✓ Done"],
  pending: ["bg-info-soft text-info", "… In progress"],
  failed: ["bg-danger-soft text-danger", "✕ Failed"],
  budget_exceeded: ["bg-warn-soft text-warn", "⚠ Hit budget cap"],
} as const;

// Colour is never the only signal: every state also carries an icon and a label.
export function StatusPill({ status }: { status: keyof typeof styles }) {
  const [cls, text] = styles[status] ?? styles.pending;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}
