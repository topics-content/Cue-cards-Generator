"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/Spinner";

// Same normalisation the server uses, so "React  Basics" and "react basics" are one module.
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

type Props = {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  loading: boolean;
  disabled: boolean;
  program: string;
};

const field =
  "w-full rounded-lg border border-line bg-surface py-2 pl-4 pr-10 text-sm text-foreground placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50";

/** Dropdown of the Program's saved modules that filters as you type and can create a new one. */
export function ModuleCombobox({ id, value, onChange, options, loading, disabled, program }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const q = norm(value);
  const exact = options.find((o) => norm(o) === q);
  const items = useMemo(() => {
    const existing = options.filter((o) => !q || norm(o).includes(q)).map((name) => ({ name, isNew: false }));
    return q && !exact ? [...existing, { name: value.trim().replace(/\s+/g, " "), isNew: true }] : existing;
  }, [options, q, exact, value]);

  useEffect(() => setActive(0), [q, open]);

  // Close on outside click; if what was typed matches a saved module, snap to its exact spelling.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
        if (exact && exact !== value) onChange(exact);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [exact, value, onChange]);

  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (items.length) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (e.key === "Enter" && open && items[active]) {
      e.preventDefault();
      choose(items[active].name);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
      if (exact && exact !== value) onChange(exact);
    }
  }

  return (
    <div ref={wrap} className="relative">
      <input
        ref={input}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
        className={field}
        value={value}
        disabled={disabled}
        autoComplete="off"
        placeholder={disabled ? "Pick a program first" : "Select or type a module"}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={open ? "Hide modules" : "Show modules"}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setOpen((o) => !o);
          input.current?.focus();
        }}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={open ? "rotate-180" : ""}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && !disabled && (
        <ul id={listId} role="listbox" aria-label={`Modules in ${program}`} className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
          {loading && (
            <li role="presentation" className="flex items-center gap-2 px-4 py-2 text-sm text-muted">
              <Spinner /> Loading modules…
            </li>
          )}
          {!loading && items.length === 0 && (
            <li role="presentation" className="px-4 py-2 text-sm text-muted">
              No saved modules for {program} yet. Type a name to create one.
            </li>
          )}
          {items.map((it, i) => (
            <li
              key={`${it.isNew ? "new" : "existing"}-${it.name}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus in the input
                choose(it.name);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-2 text-sm text-foreground ${i === active ? "bg-background" : ""}`}
            >
              {it.isNew ? (
                <>
                  Create <strong>“{it.name}”</strong>
                  <span className="ml-2 rounded bg-info-soft px-2 py-0.5 text-xs text-info">New</span>
                </>
              ) : (
                it.name
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && !loading && value.trim() && (
        <p className="mt-1 text-xs text-muted">
          {exact ? `Existing module in ${program}` : `New module: it will be saved for ${program}`}
        </p>
      )}
    </div>
  );
}
