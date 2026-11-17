import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export type ProviderId = "google" | "microsoft-entra-id";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
}

const googleOn = () => !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const microsoftOn = () =>
  !!(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET);

export function configuredProviders(): ProviderInfo[] {
  const list: ProviderInfo[] = [];
  if (googleOn()) list.push({ id: "google", label: "Google" });
  if (microsoftOn()) list.push({ id: "microsoft-entra-id", label: "Microsoft" });
  return list;
}

/** Login is only enforced when a secret and at least one provider are configured. */
export function authEnabled(): boolean {
  return !!process.env.AUTH_SECRET && configuredProviders().length > 0;
}

export function allowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS?.trim() || process.env.JIRA_EMAIL?.trim() || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function buildProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];
  if (googleOn()) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }
  if (microsoftOn()) {
    providers.push(
      MicrosoftEntraID({
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
          ? { issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER }
          : {}),
      }),
    );
  }
  return providers;
}

export const authConfig: NextAuthConfig = {
  providers: buildProviders(),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ profile, user }) {
      const email = (user?.email ?? profile?.email ?? "").toLowerCase();
      if (!email) return false;
      if (profile && "email_verified" in profile && profile.email_verified === false) return false;
      return allowedEmails().includes(email);
    },
  },
};
