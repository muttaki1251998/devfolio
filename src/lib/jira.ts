import { jiraEnv } from "./env";

export interface JiraIssue {
  id: string;
  key: string;
  fields: Record<string, unknown>;
}

export interface ChangelogItem {
  field: string;
  fieldId?: string;
  fromString?: string | null;
  toString?: string | null;
}

export interface ChangelogEntry {
  id: string;
  created: string;
  author?: { accountId?: string; displayName?: string };
  items: ChangelogItem[];
}

async function jiraFetch(path: string, init?: RequestInit): Promise<Response> {
  const { baseUrl, email, token } = jiraEnv();
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira ${init?.method || "GET"} ${path} failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return res;
}

export async function getMyself(): Promise<{ accountId: string; displayName: string }> {
  const res = await jiraFetch("/rest/api/3/myself");
  const j = (await res.json()) as { accountId: string; displayName: string };
  return { accountId: j.accountId, displayName: j.displayName };
}

/** Paginated JQL search. Yields every matching issue (bounded by maxIssues). */
export async function searchJql(
  jql: string,
  fields: string[],
  maxIssues = 2000,
): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  for (;;) {
    const res = await jiraFetch("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({ jql, fields, maxResults: 100, nextPageToken }),
    });
    const page = (await res.json()) as {
      issues?: JiraIssue[];
      nextPageToken?: string;
      isLast?: boolean;
    };
    issues.push(...(page.issues || []));
    if (!page.nextPageToken || page.isLast || issues.length >= maxIssues) break;
    nextPageToken = page.nextPageToken;
  }
  return issues;
}

/** Full changelog for one issue, oldest first. */
export async function getChangelog(issueKey: string): Promise<ChangelogEntry[]> {
  const entries: ChangelogEntry[] = [];
  let startAt = 0;
  for (;;) {
    const res = await jiraFetch(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/changelog?startAt=${startAt}&maxResults=100`,
    );
    const page = (await res.json()) as {
      values?: ChangelogEntry[];
      total?: number;
      isLast?: boolean;
    };
    entries.push(...(page.values || []));
    startAt = entries.length;
    if (page.isLast || !page.values?.length || entries.length >= (page.total ?? entries.length)) break;
  }
  return entries;
}
