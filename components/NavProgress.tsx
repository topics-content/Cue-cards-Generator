"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Thin top bar that appears the moment an internal link is clicked and clears when the route changes. */
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setActive(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setActive(false), 15_000); // never get stuck
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!active) return null;
  return (
    <div role="progressbar" aria-label="Loading page" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden">
      <div className="h-full w-1/3 animate-navbar bg-primary motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}
