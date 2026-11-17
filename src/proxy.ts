import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { authConfig, authEnabled } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const guard = auth((req) => {
  if (req.auth) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
});

export function proxy(req: NextRequest, event: NextFetchEvent) {
  if (!authEnabled()) return NextResponse.next();
  return (guard as unknown as (r: NextRequest, e: NextFetchEvent) => Promise<Response>)(req, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|login).*)"],
};
