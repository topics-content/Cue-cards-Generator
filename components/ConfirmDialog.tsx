"use client";
import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal built on the native <dialog>: focus trap, Esc to cancel and backdrop come for free. */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-xl border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-lg font-semibold">{title}</h2>
        <div className="mt-4 space-y-2 text-sm text-muted">{children}</div>
        <div className="mt-6 flex justify-end gap-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
