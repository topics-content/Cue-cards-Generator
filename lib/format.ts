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
