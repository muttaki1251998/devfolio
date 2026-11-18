import { authEnabled } from "@/auth.config";

export interface EnvStatus {
  jiraBaseUrl: boolean;
  jiraEmail: boolean;
  jiraApiToken: boolean;
  mongodbUri: boolean;
}

export function envStatus(): EnvStatus {
  return {
    jiraBaseUrl: !!process.env.JIRA_BASE_URL,
    jiraEmail: !!process.env.JIRA_EMAIL,
    jiraApiToken: !!process.env.JIRA_API_TOKEN,
    mongodbUri: !!process.env.MONGODB_URI,
  };
}

export function hasBasicCreds(): boolean {
  const s = envStatus();
  return s.jiraBaseUrl && s.jiraEmail && s.jiraApiToken;
}

/** Jira access comes from an env API token or, per session, from the Atlassian login. */
export function isConfigured(): boolean {
  return envStatus().mongodbUri && (hasBasicCreds() || authEnabled());
}

export function jiraEnv() {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!baseUrl || !email || !token) {
    throw new Error("Jira is not configured. Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN in .env.local");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), email, token };
}
