import { NextRequest, NextResponse } from "next/server";
import { resolveOwner } from "@/lib/owner";
import { loadSettings, saveSettings } from "@/lib/settings";
import { AppSettings } from "@/lib/types";


export async function GET(req: NextRequest) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await loadSettings(owner));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as Partial<AppSettings>;
    const saved = await saveSettings(owner, body);
    return NextResponse.json(saved);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
