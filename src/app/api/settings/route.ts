import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/settings";
import { AppSettings } from "@/lib/types";


export async function GET() {
  try {
    return NextResponse.json(await loadSettings());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<AppSettings>;
    const saved = await saveSettings(body);
    return NextResponse.json(saved);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
