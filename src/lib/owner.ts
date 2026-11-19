import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authEnabled } from "@/auth.config";
import type { AppJWT } from "@/auth.config";

export const LOCAL_OWNER = "local";

/** Atlassian accountId of the signed-in user, or LOCAL_OWNER when login is off; null when unauthenticated. */
export async function resolveOwner(req: NextRequest): Promise<string | null> {
  if (!authEnabled()) return LOCAL_OWNER;
  const secure =
    req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const token = (await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: secure,
  })) as (AppJWT & { accountId?: string }) | null;
  // token.sub is a random UUID in Auth.js v5 without a DB adapter — never use it as the owner.
  return token?.accountId ?? null;
}
