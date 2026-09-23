"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ScalerLogo } from "@/components/ScalerLogo";
import { Spinner } from "@/components/Spinner";
import { ThemeToggle } from "@/components/ThemeToggle";

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.2 6.9-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.500 42.600 14.600 48 24 48z" />
    </svg>
  );
}

function LoginCard() {
  const params = useSearchParams();
  const rejected = params.get("error");
  const [busy, setBusy] = useState(false);

  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-8 shadow-sm sm:p-10">
      <ScalerLogo className="h-6 w-auto text-foreground" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground">
        Cue Card Generator
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Turn a lecture script into HackMD cue cards. Sign in with your Scaler Google account to continue.
      </p>

      {rejected && (
        <p role="alert" className="mt-6 rounded-lg bg-danger-soft px-4 py-4 text-sm text-danger">
          That account can&apos;t sign in. Use your @scaler.com Google account.
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          signIn("google", { callbackUrl: params.get("callbackUrl") ?? "/" });
        }}
        className="mt-8 flex w-full items-center justify-center gap-4 rounded-lg border border-line bg-surface px-4 py-4 text-sm font-medium text-foreground shadow-sm transition hover:border-primary hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Spinner /> : <GoogleG />}
        {busy ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <p className="mt-6 text-center text-xs text-muted">Internal tool for the Scaler Content team</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main
      className="relative flex flex-1 items-center justify-center px-4 py-12"
      style={{
        backgroundImage:
          "radial-gradient(60rem 30rem at 50% -10%, var(--glow), transparent), radial-gradient(var(--line) 1px, transparent 1px)",
        backgroundSize: "auto, 24px 24px",
      }}
    >
      <ThemeToggle className="absolute right-4 top-4" />
      <Suspense>
        <LoginCard />
      </Suspense>
    </main>
  );
}
