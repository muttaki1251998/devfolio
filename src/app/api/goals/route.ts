import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { countsForPeriod } from "@/lib/metrics";
import { loadSettings } from "@/lib/settings";
import { GoalDoc, MetricEventType } from "@/lib/types";


const METRICS: MetricEventType[] = ["pregroomed", "sent_to_testing", "qa_bounce"];

export async function GET() {
  try {
    const db = await getDb();
    const settings = await loadSettings();
    const goals = await db.collection<GoalDoc>("goals").find().sort({ createdAt: -1 }).toArray();
    const out = [];
    for (const g of goals) {
      let progress: number | null = null;
      if (g.metric && g.period) {
        progress = await countsForPeriod(g.metric, g.period, settings.weekStartsMonday);
      }
      out.push({ ...g, _id: (g as { _id?: ObjectId })._id?.toString(), progress });
    }
    return NextResponse.json({ goals: out });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GoalDoc>;
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const goal: GoalDoc = {
      title: body.title.slice(0, 300),
      done: false,
      createdAt: new Date().toISOString(),
      metric: body.metric && METRICS.includes(body.metric) ? body.metric : null,
      target: typeof body.target === "number" && body.target > 0 ? body.target : null,
      period: body.period === "week" || body.period === "month" ? body.period : null,
    };
    const db = await getDb();
    const res = await db.collection<GoalDoc>("goals").insertOne(goal);
    return NextResponse.json({ ...goal, _id: res.insertedId.toString() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
