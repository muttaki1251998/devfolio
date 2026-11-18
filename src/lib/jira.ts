export type JiraAuth =
  | { mode: "basic"; baseUrl: string; email: string; token: string }
  | { mode: "oauth"; cloudId: string; accessToken: string };

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

async function jiraFetch(auth: JiraAuth, path: string, init?: RequestInit): Promise<Response> {
  const url =
    auth.mode === "basic"
      ? `${auth.baseUrl}${path}`
      : `https://api.atlassian.com/ex/jira/${auth.cloudId}${path}`;
  const authorization =
    auth.mode === "basic"
      ? `Basic ${Buffer.from(`${auth.email}:${auth.token}`).toString("base64")}`
      : `Bearer ${auth.accessToken}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: authorization,
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

export async function getMyself(auth: JiraAuth): Promise<{ accountId: string; displayName: string }> {
  const res = await jiraFetch(auth, "/rest/api/3/myself");
  const j = (await res.json()) as { accountId: string; displayName: string };
  return { accountId: j.accountId, displayName: j.displayName };
}

/** Paginated JQL search. Yields every matching issue (bounded by maxIssues). */
export async function searchJql(
  auth: JiraAuth,
  jql: string,
  fields: string[],
  maxIssues = 2000,
): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  for (;;) {
    const res = await jiraFetch(auth, "/rest/api/3/search/jql", {
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
export async function getChangelog(auth: JiraAuth, issueKey: string): Promise<ChangelogEntry[]> {
  const entries: ChangelogEntry[] = [];
  let startAt = 0;
  for (;;) {
    const res = await jiraFetch(
      auth,
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
