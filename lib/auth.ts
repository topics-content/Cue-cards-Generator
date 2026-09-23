import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { NextResponse } from "next/server";
import { isAdminEmail, isScalerEmail } from "@/lib/admin";
import { upsertUser } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // `hd` is only a picker hint. The signIn callback below is the real control.
      authorization: { params: { hd: "scaler.com", prompt: "select_account" } },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, profile }) {
      const email = user.email?.toLowerCase();
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
      if (!isScalerEmail(email) || verified === false) return false;
      try {
        await upsertUser(email, user.name ?? null);
      } catch (err) {
        // Don't lock people out because the DB hiccuped (e.g. Supabase waking from pause).
        console.error("upsertUser failed", err);
      }
      return true;
    },
    async jwt({ token }) {
      token.email = token.email?.toLowerCase();
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email;
        session.user.isAdmin = isAdminEmail(token.email);
      }
      return session;
    },
  },
};

export type AuthedUser = { email: string; name: string | null; isAdmin: boolean };

/** Current user from the session, or null. Re-checks domain and admin status server-side. */
export async function getUser(): Promise<AuthedUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!isScalerEmail(email)) return null;
  return { email, name: session?.user?.name ?? null, isAdmin: isAdminEmail(email) };
}

type Guard = { user: AuthedUser; error?: never } | { user?: never; error: NextResponse };

/** For route handlers: 401 if signed out, never a redirect. */
export async function requireUser(): Promise<Guard> {
  const user = await getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

/** For admin route handlers: 401 if signed out, 403 if not an admin. */
export async function requireAdmin(): Promise<Guard> {
  const guard = await requireUser();
  if (guard.error) return guard;
  if (!guard.user.isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return guard;
}
