export default function SetupCard({
  env,
  mongoOk,
}: {
  env: Record<string, boolean>;
  mongoOk: boolean;
}) {
  const rows: [string, string, boolean][] = [
    ["JIRA_BASE_URL", "Your Jira site, e.g. https://yourteam.atlassian.net", env.jiraBaseUrl],
    ["JIRA_EMAIL", "The Atlassian account email", env.jiraEmail],
    ["JIRA_API_TOKEN", "From id.atlassian.com → Security → API tokens", env.jiraApiToken],
    ["MONGODB_URI", "MongoDB connection string (Atlas free tier or local)", env.mongodbUri],
  ];
  const dot = (ok: boolean) => (
    <span
      aria-hidden
      className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: ok ? "var(--good)" : "var(--accent)", opacity: ok ? 1 : 0.55 }}
    />
  );
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">First run</p>
      <h2 className="mt-3 font-serif text-[44px] font-normal leading-[1.05] tracking-[-0.02em]">
        Let’s get you set up<span className="text-accent">.</span>
      </h2>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        Devfolio reads your Jira changelog with your own API token and keeps a copy in your own
        MongoDB. Create a <code className="rounded-[3px] bg-inset px-1.5 py-0.5 text-[13px]">.env.local</code>{" "}
        file in the project root with:
      </p>
      <ul className="mt-8 border-t border-hairline">
        {rows.map(([name, hint, ok]) => (
          <li key={name} className="flex items-start gap-3.5 border-b border-divider py-4">
            {dot(ok)}
            <div>
              <code className="text-sm font-semibold">{name}</code>
              <p className="mt-0.5 text-[13px] text-muted">{hint}</p>
            </div>
          </li>
        ))}
        <li className="flex items-start gap-3.5 border-b border-divider py-4">
          {dot(mongoOk)}
          <div>
            <span className="text-sm font-semibold">MongoDB reachable</span>
            <p className="mt-0.5 text-[13px] text-muted">The app could {mongoOk ? "" : "not "}connect.</p>
          </div>
        </li>
      </ul>
      <p className="mt-5 text-[13px] text-muted">Restart the dev server after editing .env.local.</p>
    </div>
  );
}
