"use client";
import { useState } from "react";
import type { Issue, ValidationResult } from "@/lib/validateCards";

type Group = { key: string; name: string; type?: string; title?: string; loc?: string; items: Issue[] };

function IssueRow({ issue, tone, onJump }: { issue: Issue; tone: "e" | "w"; onJump: (line: number) => void }) {
  const border = tone === "e" ? "border-l-danger" : "border-l-warn";
  const tagCls = tone === "e" ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn";
  return (
    <div className={`mt-2 rounded-md border border-line border-l-4 ${border} bg-background p-3 text-xs leading-relaxed`}>
      <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${tagCls}`}>{tone === "e" ? "ERROR" : "WARN"}</span>
      <button type="button" onClick={() => onJump(issue.line)} className="font-semibold text-muted underline decoration-dotted hover:text-brand" title="Jump to this line">
        L{issue.line}
      </button>{" "}
      <span>{issue.msg}</span>
      {issue.hint && <span className="mt-1 block text-muted">↳ {issue.hint}</span>}
    </div>
  );
}

function IssueGroupRow({ g, tone, open, onToggle, onJump }: { g: Group; tone: "e" | "w"; open: boolean; onToggle: () => void; onJump: (line: number) => void }) {
  return (
    <div className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-background"
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        <span className="font-semibold">{g.name}</span>
        {g.type && <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-bold text-muted">{g.type}</span>}
        <span className="truncate text-muted">{g.title}</span>
        <span className="ml-auto rounded-full bg-line px-1.5 py-0.5 text-[10px] font-bold text-muted">{g.items.length}</span>
        {g.loc && <span className="whitespace-nowrap text-muted">{g.loc}</span>}
      </button>
      {open && <div className="px-3 pb-3">{g.items.map((it, i) => <IssueRow key={i} issue={it} tone={tone} onJump={onJump} />)}</div>}
    </div>
  );
}

export function IssueBox({ kind, groups, total, onJump }: { kind: "err" | "warn"; groups: Group[]; total: number; onJump: (line: number) => void }) {
  const [boxOpen, setBoxOpen] = useState(kind === "err" ? total > 0 : total > 0);
  const [rowOpen, setRowOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(groups.map((g) => [g.key, true])));
  const isErr = kind === "err";
  const label = isErr ? "Errors" : "Warnings";
  const tone = isErr ? "e" : "w";
  const pillCls = isErr ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn";

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line">
      <button type="button" onClick={() => setBoxOpen((o) => !o)} className="flex w-full items-center gap-2 bg-background px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface">
        <span className={`inline-block transition-transform ${boxOpen ? "rotate-90" : ""}`}>▸</span>
        {label}
        <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${pillCls}`}>{total}</span>
        {boxOpen && groups.length > 0 && (
          <span className="ml-auto flex gap-2 text-[11px] font-medium text-muted">
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setRowOpen(Object.fromEntries(groups.map((g) => [g.key, true]))); }} className="hover:text-foreground">
              Expand all
            </span>
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setRowOpen(Object.fromEntries(groups.map((g) => [g.key, false]))); }} className="hover:text-foreground">
              Collapse all
            </span>
          </span>
        )}
      </button>
      {boxOpen && (
        <div>
          {groups.length === 0 ? (
            <p className="p-3 text-xs text-muted">No {label.toLowerCase()} found.</p>
          ) : (
            groups.map((g) => (
              <IssueGroupRow key={g.key} g={g} tone={tone} open={rowOpen[g.key] ?? true} onToggle={() => setRowOpen((s) => ({ ...s, [g.key]: !s[g.key] }))} onJump={onJump} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function toGroups(result: ValidationResult): { errGroups: Group[]; warnGroups: Group[] } {
  const errGroups: Group[] = [];
  if (result.docErrors.length) errGroups.push({ key: "doc", name: "Document", title: "issues outside any card", items: result.docErrors });
  for (const c of result.cards) {
    if (c.errors.length) errGroups.push({ key: `err-${c.index}`, name: `Card ${c.index}`, type: c.cardType, title: c.title, loc: c.loc, items: c.errors });
  }
  const warnGroups: Group[] = [];
  for (const c of result.cards) {
    if (c.warnings.length) warnGroups.push({ key: `warn-${c.index}`, name: `Card ${c.index}`, type: c.cardType, title: c.title, loc: c.loc, items: c.warnings });
  }
  return { errGroups, warnGroups };
}
