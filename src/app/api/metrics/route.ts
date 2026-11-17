import { NextRequest, NextResponse } from "next/server";
import { dashboardData, Period } from "@/lib/metrics";


export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("period");
  const period: Period = p === "month" || p === "all" ? p : "week";
  try {
    return NextResponse.json(await dashboardData(period));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
