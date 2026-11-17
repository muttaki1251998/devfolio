export type MetricEventType = "pregroomed" | "sent_to_testing" | "qa_bounce";

export interface TicketDoc {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  issueType: string;
  priority?: string | null;
  storyPoints?: number | null;
  isMine: boolean;
  jiraUpdatedAt: string;
  jiraCreatedAt: string;
  /** When the ticket last changed status (from changelog); used for aging. */
  statusSince?: string | null;
  /** Value of jiraUpdatedAt when the changelog was last scanned. */
  scannedUpdatedAt?: string | null;
}

export interface MetricEventDoc {
  ticketKey: string;
  type: MetricEventType;
  /** ISO timestamp of the changelog entry that produced the event. */
  at: string;
}

export interface GoalDoc {
  title: string;
  done: boolean;
  createdAt: string;
  /** When set, progress is computed automatically from metric events. */
  metric?: MetricEventType | null;
  target?: number | null;
  period?: "week" | "month" | null;
}

export interface AppSettings {
  /** Custom field whose first change by the user marks a ticket as pregroomed. */
  analysisFieldId: string;
  /** Custom field whose first change by the user marks a ticket as sent to testing. */
  resolutionFieldId: string;
  /** "...By" user-picker fields; used only to find candidate tickets cheaply via JQL. */
  analysisByFieldId: string;
  resolutionByFieldId: string;
  storyPointsFieldId: string;
  /** A transition testingStatus -> reworkStatus counts as a QA bounce. */
  testingStatus: string;
  reworkStatus: string;
  /** Status buckets shown on the My Tickets screen, in order. */
  boardStatuses: string[];
  weekStartsMonday: boolean;
  /** Days in the same status before a ticket is flagged as stale. */
  staleAfterDays: number;
  userName: string;
}

export interface SyncStateDoc {
  _id: string;
  lastSyncAt?: string | null;
  lastSyncResult?: string | null;
  accountId?: string | null;
  displayName?: string | null;
  /** True once a full (unbounded) candidate scan has completed. */
  fullScanDone?: boolean;
}

export interface MetricCounts {
  pregroomed: number;
  sentToTesting: number;
  qaBounces: number;
  pregroomedPoints: number;
  sentPoints: number;
}

export interface EventRow extends MetricEventDoc {
  summary?: string;
  status?: string;
  storyPoints?: number | null;
}
