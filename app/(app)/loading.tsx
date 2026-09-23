import { Spinner } from "@/components/Spinner";

// Shown by Next while any signed-in page is rendering on the server.
export default function Loading() {
  return (
    <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-muted">
      <Spinner className="h-8 w-8 text-primary" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}
