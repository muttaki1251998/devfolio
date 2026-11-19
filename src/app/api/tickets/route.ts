import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import { resolveOwner } from "@/lib/owner";
import { loadSettings } from "@/lib/settings";
import { TicketDoc } from "@/lib/types";


export async function GET(req: NextRequest) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const settings = await loadSettings(owner);
    const tickets = await db
      .collection<TicketDoc>("tickets")
      .find({ owner, isMine: true, statusCategory: { $ne: "Done" } })
      .sort({ jiraUpdatedAt: -1 })
      .toArray();

    const now = Date.now();
    const rows = tickets.map((t) => ({
      key: t.key,
      summary: t.summary,
      status: t.status,
      issueType: t.issueType,
      priority: t.priority,
      storyPoints: t.storyPoints,
      updatedAt: t.jiraUpdatedAt,
      daysInStatus: t.statusSince
        ? Math.floor((now - new Date(t.statusSince).getTime()) / 86_400_000)
        : null,
    }));
    return NextResponse.json({
      rows,
      boardStatuses: settings.boardStatuses,
      staleAfterDays: settings.staleAfterDays,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
