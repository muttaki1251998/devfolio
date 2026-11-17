import { NextResponse } from "next/server";
import { homeData } from "@/lib/metrics";


export async function GET() {
  try {
    return NextResponse.json(await homeData());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
