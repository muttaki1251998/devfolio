import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { authEnabled, configuredProviders } from "@/auth.config";
import type { ProviderId } from "@/auth.config";

export const metadata = { title: "Sign in — Devfolio" };

const STATS = [
  { value: "87", label: "tickets pregroomed", accent: false },
  { value: "123", label: "sent to testing", accent: false },
  { value: "80%", label: "clean handoffs", accent: true },
];

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.7-6c-2.1 1.4-4.8 2.3-7.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

const LOGOS: Record<ProviderId, () => React.ReactNode> = {
  google: GoogleLogo,
  "microsoft-entra-id": MicrosoftLogo,
};

function Sun() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 right-4 h-[105px] w-[200px] sm:right-12 sm:h-[200px] sm:w-[380px]"
      viewBox="0 0 380 200"
      fill="none"
    >
      <line x1="0" y1="199" x2="380" y2="199" stroke="#D8CCB4" strokeWidth="1.5" />
      <circle cx="190" cy="200" r="80" fill="#C2551F" />
      <g stroke="#C2551F" strokeWidth="3" strokeLinecap="round">
        <line x1="90" y1="200" x2="62" y2="200" />
        <line x1="103.4" y1="150" x2="79.1" y2="136" />
        <line x1="140" y1="113.4" x2="126" y2="89.1" />
        <line x1="190" y1="100" x2="190" y2="72" />
        <line x1="240" y1="113.4" x2="254" y2="89.1" />
        <line x1="276.6" y1="150" x2="300.9" y2="136" />
        <line x1="290" y1="200" x2="318" y2="200" />
      </g>
    </svg>
  );
}

const ERROR_TEXT: Record<string, string> = {
  AccessDenied: "That account isn’t on this dashboard’s allowlist. Try the account you set up for it.",
};

async function SignInPanel({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const { error } = await searchParams;
  const providers = configuredProviders();

  if (authEnabled()) {
    const session = await auth();
    if (session?.user) redirect("/");
  }

  const errorText = error
    ? (ERROR_TEXT[error] ?? "Sign-in didn’t complete. Please try again.")
    : null;

  return (
    <>
      <h2 className="font-serif text-[30px] font-medium">Welcome back</h2>
      {providers.length > 0 ? (
        <>
          <p className="mt-3 text-sm leading-[1.6] text-muted">
            Sign in with your work account to open your dashboard.
          </p>
          {errorText && (
            <p role="alert" className="mt-5 border-l-[3px] border-accent pl-3 text-[13px] leading-[1.6] text-deep">
              {errorText}
            </p>
          )}
          <div className="mt-9 flex flex-col gap-3">
            {providers.map((p) => {
              const Logo = LOGOS[p.id];
              return (
                <form
                  key={p.id}
                  action={async () => {
                    "use server";
                    await signIn(p.id, { redirectTo: "/" });
                  }}
                >
                  <button
                    type="submit"
                    className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-[#D8CCB4] bg-white px-5 py-3.5 font-sans text-[15px] font-medium text-ink hover:border-accent"
                  >
                    <Logo />
                    Continue with {p.label}
                  </button>
                </form>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-3 text-sm leading-[1.6] text-muted">
          <p>
            Login isn’t configured, so there’s nothing to sign in to. Devfolio is open on this server
            until you add an OAuth provider in{" "}
            <code className="rounded-[3px] bg-inset px-1.5 py-0.5 text-[13px]">.env.local</code>.
          </p>
          <Link href="/" className="mt-6 inline-block font-medium text-deep hover:underline">
            Go to the dashboard
          </Link>
        </div>
      )}

      <div className="mt-8 border-t border-divider pt-5">
        <p className="text-[13px] leading-[1.6] text-muted">
          Only your workspace account is used to sign you in. Jira credentials are configured once,
          on the server, by you.
        </p>
      </div>
    </>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-wrap items-stretch bg-paper">
      <section className="relative flex min-w-0 grow-[999] basis-[560px] flex-col overflow-hidden px-6 pb-[140px] pt-10 sm:px-16 sm:py-[72px]">
        <Sun />
        <span className="relative font-serif text-[26px] font-semibold italic tracking-[-0.02em]">
          devfolio
        </span>

        <div className="relative my-auto py-12">
          <p className="eyebrow mb-4">Your personal Jira morning paper</p>
          <h1 className="font-serif text-[44px] font-normal leading-[1.08] tracking-[-0.02em] sm:text-[64px]">
            Good mornings,
            <br />
            counted<span className="text-accent">.</span>
          </h1>
          <p className="mt-[22px] max-w-[520px] text-[17px] leading-[1.6] text-muted">
            Devfolio reads your Jira changelog and greets you each morning with what you pregroomed,
            what you handed to QA, and what needs a nudge — then drafts your standup for you.
          </p>

          <div className="mt-11 flex max-w-[560px] flex-wrap border-t border-hairline">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`basis-[150px] grow pt-5 ${
                  i === 0 ? "pr-7" : i === STATS.length - 1 ? "border-l border-hairline pl-7" : "border-l border-hairline px-7"
                }`}
              >
                <div
                  className={`font-serif text-[34px] font-light leading-none ${s.accent ? "text-accent" : ""}`}
                >
                  {s.value}
                </div>
                <div className="mt-1.5 text-xs font-medium text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[13px] text-muted">
          Open source · self-hosted · your Jira token never leaves your server
        </p>
      </section>

      <section className="flex w-full grow basis-[400px] flex-col justify-center bg-panel px-6 py-12 shadow-[-2px_0_14px_rgba(93,70,38,0.1)] sm:px-16 sm:py-[72px] min-[960px]:max-w-[520px]">
        <Suspense fallback={<h2 className="font-serif text-[30px] font-medium">Welcome back</h2>}>
          <SignInPanel searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}
