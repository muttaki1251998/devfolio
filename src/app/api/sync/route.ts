import { NextRequest, NextResponse } from "next/server";
import { isConfigured } from "@/lib/env";
import { resolveJiraAuth } from "@/lib/jira-auth";
import { runSync } from "@/lib/sync";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ ok: false, error: "Not configured" }, { status: 503 });
  }
  const resolved = await resolveJiraAuth(req);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });
  }
  const ifStale = req.nextUrl.searchParams.get("ifStale");
  const result = await runSync(
    resolved.auth,
    ifStale ? { ifStaleMinutes: Number(ifStale) || 15 } : undefined,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
