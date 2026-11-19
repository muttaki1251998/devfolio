import "next-auth";

declare module "next-auth" {
  interface Session {
    authError?: boolean;
    jiraSiteUrl?: string | null;
    accountId: string | null;
  }
}
