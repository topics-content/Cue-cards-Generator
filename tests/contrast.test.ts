import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guards the design tokens in app/globals.css: every text pair must stay WCAG AA (4.5:1).
const css = readFileSync("app/globals.css", "utf8");

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}
const light = tokens(css.match(/:root\s*{([^}]*)}/)![1]);
// Dark tokens exist twice: for an explicit choice and for "follow the OS". They must not drift.
const darkExplicit = tokens(css.match(/:root\[data-theme="dark"\]\s*{([^}]*)}/)![1]);
const darkSystem = tokens(css.match(/prefers-color-scheme:\s*dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)\s*{([^}]*)}/)![1]);
const dark = darkExplicit;

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [text token, background token]
const PAIRS: [string, string][] = [
  ["foreground", "background"], ["foreground", "surface"],
  ["muted", "background"], ["muted", "surface"],
  ["primary-fg", "primary"], ["primary-fg", "primary-hover"],
  ["brand", "surface"], ["brand", "background"],
  ["accent", "surface"], ["accent", "background"], ["accent-fg", "accent"],
  ["ok", "ok-soft"], ["warn", "warn-soft"], ["danger", "danger-soft"], ["info", "info-soft"],
  ["ok", "surface"], ["warn", "surface"], ["danger", "surface"], ["info", "surface"],
];

it("the two dark blocks are identical", () => {
  expect(darkSystem).toEqual(darkExplicit);
  expect(Object.keys(darkExplicit).length).toBeGreaterThan(15);
});

describe.each([["light", light], ["dark", dark]] as const)("%s theme", (_name, t) => {
  it("defines every token", () => {
    for (const [a, b] of PAIRS) {
      expect(t[a], a).toBeDefined();
      expect(t[b], b).toBeDefined();
    }
  });
  it.each(PAIRS)("%s on %s passes WCAG AA", (a, b) => {
    expect(ratio(t[a], t[b])).toBeGreaterThanOrEqual(4.5);
  });
});
