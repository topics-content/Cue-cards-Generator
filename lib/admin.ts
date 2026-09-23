// Edge-safe (no Node-only imports): used by middleware and server code alike.
export const ALLOWED_DOMAIN = "@scaler.com";

export function isScalerEmail(email: string | null | undefined): email is string {
  return !!email && email.trim().toLowerCase().endsWith(ALLOWED_DOMAIN);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
