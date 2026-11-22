import { NextRequest, NextResponse } from "next/server";
import { dashboardData, isPeriod } from "@/lib/metrics";
import { resolveOwner } from "@/lib/owner";


export async function GET(req: NextRequest) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = req.nextUrl.searchParams.get("period");
  const period = isPeriod(p) ? p : "week";
  try {
    return NextResponse.json(await dashboardData(owner, period));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
