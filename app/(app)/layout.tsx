import Link from "next/link";
import { redirect } from "next/navigation";
import { ScalerLogo } from "@/components/ScalerLogo";
import { UserMenu } from "@/components/UserMenu";
import { getUser } from "@/lib/auth";

// Shell for every signed-in page. The middleware gates access; this re-checks server-side.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const link = "text-sm font-medium text-muted transition hover:text-foreground";
  return (
    <div className="flex-1">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" aria-label="Cue Card Generator home" className="flex items-center gap-4">
              <ScalerLogo className="h-5 w-auto text-foreground" />
              <span className="hidden border-l border-line pl-4 text-sm font-medium text-muted sm:inline">
                Cue Card Generator
              </span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/" className={link}>New cue cards</Link>
              <Link href="/decks" className={link}>My cue cards</Link>
              <Link href="/cost-observatory" className={link}>Cost Observatory</Link>
            </nav>
          </div>
          <UserMenu email={user.email} isAdmin={user.isAdmin} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
