"use client";
import { useEffect, useState } from "react";

type Choice = "light" | "system" | "dark";
const KEY = "theme";

function apply(choice: Choice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

const icons: Record<Choice, React.ReactNode> = {
  light: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  system: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" />
    </svg>
  ),
  dark: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
};

const labels: Record<Choice, string> = { light: "Light", system: "System", dark: "Dark" };

/** Light / System / Dark. The choice is saved in this browser; System follows the OS. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<Choice | null>(null); // null until mounted, so server and client markup match

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* storage blocked: fall back to System */
    }
    setChoice(saved === "light" || saved === "dark" ? saved : "system");
  }, []);

  function pick(next: Choice) {
    setChoice(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* not persisted, still applied for this visit */
    }
  }

  return (
    <div role="group" aria-label="Theme" className={`inline-flex overflow-hidden rounded-lg border border-line ${className}`}>
      {(["light", "system", "dark"] as const).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={choice === c}
          aria-label={`${labels[c]} theme`}
          title={`${labels[c]} theme`}
          onClick={() => pick(c)}
          className={`flex h-8 w-8 items-center justify-center transition ${
            choice === c ? "bg-primary text-primary-fg" : "text-muted hover:bg-background hover:text-foreground"
          }`}
        >
          {icons[c]}
        </button>
      ))}
    </div>
  );
}
