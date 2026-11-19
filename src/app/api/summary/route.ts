import { NextRequest, NextResponse } from "next/server";
import { homeData } from "@/lib/metrics";
import { resolveOwner } from "@/lib/owner";


export async function GET(req: NextRequest) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await homeData(owner));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
