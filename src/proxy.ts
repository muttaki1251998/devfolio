import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Same check as authEnabled() in auth.config, inlined so the middleware bundle doesn't pull
// in auth.config's imports (the Mongo token store and its driver).
const authEnabled = () =>
  !!(process.env.AUTH_SECRET && process.env.AUTH_ATLASSIAN_ID && process.env.AUTH_ATLASSIAN_SECRET);

export async function proxy(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const secure =
    req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie: secure });
  // A session from before owner scoping has no accountId; it must sign in again
  // so data can be keyed to the Atlassian account (token.sub is a random UUID).
  if ((token as { accountId?: string } | null)?.accountId) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
}

export const config = {
  // /api/status is open on purpose: it reports whether you are signed in (and says nothing
  // else when you are not), so the client can tell an expired session from an outage.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/auth|api/status|login).*)"],
};
