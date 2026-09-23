import Link from "next/link";
import type { ReactNode } from "react";

/** Link to a saved cue card. Only its creator or an admin can open it, so others get plain text. */
export function CardLink({ id, canOpen, children }: { id: string; canOpen: boolean; children: ReactNode }) {
  if (canOpen) {
    return <Link href={`/decks/${id}`} className="font-medium text-brand hover:underline">{children}</Link>;
  }
  return <span className="font-medium" title="Only the creator or an admin can open this">{children}</span>;
}
