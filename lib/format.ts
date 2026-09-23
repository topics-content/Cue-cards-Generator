export function usd(n: number): string {
  return n !== 0 && Math.abs(n) < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

/** INR is derived at display time only: USD × INR_RATE. Nothing in INR is ever stored. */
export function inr(usdAmount: number, rate: number): string {
  const v = usdAmount * rate;
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) < 1000 ? 2 : 0 });
}

export function tokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function duration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Human label for a span that can run from seconds to days (a deck's full create-to-finish time,
 * which includes any budget-pause wait) — "45s", "12m", "3h 20m", "2d 4h". Unlike duration() above
 * (mm:ss, for a single live run this session), this never renders triple-digit minute counts.
 */
export function longDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
