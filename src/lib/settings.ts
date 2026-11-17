import { getDb } from "./mongo";
import { DEFAULT_SETTINGS } from "./defaults";
import { AppSettings } from "./types";

const SETTINGS_ID = "app";

export async function loadSettings(): Promise<AppSettings> {
  const db = await getDb();
  const doc = await db.collection("settings").findOne({ _id: SETTINGS_ID as never });
  if (!doc) return { ...DEFAULT_SETTINGS };
  const { _id, ...rest } = doc as Record<string, unknown>;
  void _id;
  return { ...DEFAULT_SETTINGS, ...(rest as Partial<AppSettings>) };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const db = await getDb();
  const clean: Partial<AppSettings> = {};
  const allowed: (keyof AppSettings)[] = [
    "analysisFieldId",
    "resolutionFieldId",
    "analysisByFieldId",
    "resolutionByFieldId",
    "storyPointsFieldId",
    "testingStatus",
    "reworkStatus",
    "boardStatuses",
    "weekStartsMonday",
    "staleAfterDays",
    "userName",
  ];
  for (const k of allowed) {
    if (patch[k] !== undefined) (clean as Record<string, unknown>)[k] = patch[k];
  }
  await db
    .collection("settings")
    .updateOne({ _id: SETTINGS_ID as never }, { $set: clean }, { upsert: true });
  return loadSettings();
}
