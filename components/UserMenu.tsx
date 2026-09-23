"use client";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Spinner } from "@/components/Spinner";
import { ThemeToggle } from "@/components/ThemeToggle";

export function UserMenu({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-4 text-sm">
      <ThemeToggle />
      <span className="hidden text-muted sm:inline">
        {email}
        {isAdmin && (
          <span className="ml-2 rounded-full border border-accent px-2 py-0.5 text-xs font-medium text-brand">
            Admin
          </span>
        )}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signOut({ callbackUrl: "/login" });
        }}
        className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 font-medium text-foreground transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy && <Spinner className="h-4 w-4" />}
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
