import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isScalerEmail } from "@/lib/admin";

// Coarse gate only. Every route handler re-checks the session server-side.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const email = token?.email?.toLowerCase();
  const isApi = pathname.startsWith("/api/");

  if (!isScalerEmail(email)) {
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/auth|api/cron).*)"],
};
