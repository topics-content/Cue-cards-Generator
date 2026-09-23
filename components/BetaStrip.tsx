const CONTACT = "ankit.mishra@scaler.com";

/** Notice shown at the top of every page. */
export function BetaStrip() {
  return (
    <div role="note" className="border-b border-line bg-warn-soft px-4 py-2 text-center text-sm text-warn">
      <span className="mr-2 rounded bg-warn px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wide text-warn-soft">Beta</span>
      Beta version. AI can make mistakes. For access or issues, reach out to{" "}
      <a href={`mailto:${CONTACT}`} className="font-medium underline underline-offset-2 hover:no-underline">
        {CONTACT}
      </a>
    </div>
  );
}
