import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: { navbar: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(300%)" } } },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      animation: { navbar: "navbar 1.1s ease-in-out infinite" },
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        line: "var(--line)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          fg: "var(--primary-fg)",
        },
        brand: "var(--brand)",
        accent: { DEFAULT: "var(--accent)", fg: "var(--accent-fg)" },
        danger: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)" },
        warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)" },
        ok: { DEFAULT: "var(--ok)", soft: "var(--ok-soft)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
      },
    },
  },
  plugins: [],
};
export default config;
