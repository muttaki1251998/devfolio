import { AppSettings } from "./types";

/**
 * Defaults match a workflow where pregrooming fills an "Analysis Results"
 * field and handing work to QA fills a "Resolution Details" field.
 * Every id and status name is editable on the Settings screen, so the app
 * adapts to any Jira site.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  analysisFieldId: "customfield_11525",
  resolutionFieldId: "customfield_11523",
  analysisByFieldId: "customfield_11583",
  resolutionByFieldId: "customfield_11584",
  storyPointsFieldId: "customfield_10506",
  testingStatus: "In Test",
  reworkStatus: "In Dev",
  boardStatuses: [
    "In Pre-Grooming",
    "Ready For Development",
    "In Dev",
    "To Review",
    "Ready for Testing",
    "In Test",
  ],
  weekStartsMonday: true,
  staleAfterDays: 3,
  userName: "",
};
