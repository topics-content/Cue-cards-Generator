"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { ThemeToggle } from "@/components/ThemeToggle";

function GoogleG() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.2 6.9-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.500 42.600 14.600 48 24 48z" />
    </svg>
  );
}

/** The small app mark, theme-reactive (unlike app/icon.svg, which stays a fixed brand colour for OS chrome). */
function BrandMark() {
  return (
    <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-primary">
      <svg width="22" height="22" viewBox="14 32 92 76" aria-hidden>
        <path d="M78 42 a28 28 0 1 0 0 56" fill="none" stroke="var(--primary-fg)" strokeOpacity=".4" strokeWidth="15" strokeLinecap="round" />
        <path d="M96 42 a28 28 0 1 0 0 56" fill="none" stroke="var(--primary-fg)" strokeWidth="15" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" />
    </svg>
  );
}

function SignInCard() {
  const params = useSearchParams();
  const rejected = params.get("error");
  const [busy, setBusy] = useState(false);

  return (
    <div className="w-full max-w-[404px] rounded-[20px] border border-line bg-surface p-9 pb-7 shadow-xl">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h2>
      <p className="mb-7 mt-2 text-sm leading-relaxed text-muted">
        Use your Scaler Google account to open the Cue Card Generator.
      </p>

      {rejected && (
        <p role="alert" className="mb-6 rounded-lg bg-danger-soft px-4 py-4 text-sm text-danger">
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
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-white">
          {busy ? <Spinner className="h-3.5 w-3.5 text-foreground" /> : <GoogleG />}
        </span>
        {busy ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <div className="mt-3.5 flex items-center justify-center gap-2 text-xs text-muted">
        <LockIcon />
        <span>
          Restricted to{" "}
          <code className="rounded border border-line bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">@scaler.com</code> accounts
        </span>
      </div>

      <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-line" />
        What happens next
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex gap-2.5 rounded-xl border border-line bg-background p-3.5 text-xs leading-relaxed text-muted">
        <InfoIcon className="mt-0.5 shrink-0 text-primary" />
        <span>You&apos;ll land on New cue cards. Pick program and module, drop a script, and generate.</span>
      </div>

      <p className="mt-5 text-center text-xs text-muted">
        Trouble signing in?{" "}
        <a href="mailto:ankit.mishra@scaler.com" className="text-foreground underline decoration-line underline-offset-2 hover:decoration-foreground">
          Ping Ankit
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main
      className="relative flex-1 overflow-hidden"
      style={{ backgroundImage: "radial-gradient(var(--line) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
    >
      <div className="pointer-events-none absolute -left-48 -top-44 h-[600px] w-[600px] rounded-full bg-primary opacity-10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-56 -right-40 h-[480px] w-[480px] rounded-full bg-primary opacity-[0.06] blur-[120px]" />
      <ThemeToggle className="absolute right-6 top-6 z-10" />

      <div className="relative grid min-h-full grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-center gap-6 px-7 py-14 lg:gap-8 lg:px-[60px] lg:py-16">
          <div className="flex items-center gap-3">
            <BrandMark />
            <p className="text-sm font-bold tracking-[0.14em] text-foreground">
              SCALER<span className="ml-2.5 text-xs font-medium tracking-normal text-muted">Content Tools</span>
            </p>
          </div>
          <div>
            <h1 className="max-w-[13ch] text-4xl font-bold leading-[1.1] tracking-tight text-foreground lg:text-[2.875rem] lg:leading-[1.07]">
              Lecture scripts to <span className="text-primary">cue cards</span>, in one pass.
            </h1>
            <p className="mt-4 max-w-[45ch] text-base leading-relaxed text-muted lg:text-lg">
              Paste a notebook or markdown script. Get SOP-compliant HackMD cue cards back — formatted, sectioned, ready to publish.
            </p>
          </div>
          <div className="hidden items-center gap-6 text-xs text-muted lg:flex">
            <span>Internal tool · Content Team</span>
            <span>v0.9 beta</span>
          </div>
        </section>

        <section className="grid place-items-center px-5 pb-14 pt-4 lg:px-12 lg:py-16">
          <Suspense>
            <SignInCard />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
