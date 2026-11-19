import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { resolveOwner } from "@/lib/owner";
import { GoalDoc } from "@/lib/types";


type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as { done?: boolean; title?: string };
    const patch: Partial<GoalDoc> = {};
    if (typeof body.done === "boolean") patch.done = body.done;
    if (typeof body.title === "string" && body.title) patch.title = body.title.slice(0, 300);
    const db = await getDb();
    await db.collection<GoalDoc>("goals").updateOne({ _id: new ObjectId(id) as never, owner }, { $set: patch });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const db = await getDb();
    await db.collection<GoalDoc>("goals").deleteOne({ _id: new ObjectId(id) as never, owner });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
