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
  return (
    <div className="card max-w-2xl p-8">
      <h2 className="font-serif text-2xl font-semibold">Let’s get you set up</h2>
      <p className="mt-2 text-sm text-soft">
        Devfolio reads your Jira changelog with your own API token and keeps a copy in your own
        MongoDB. Create a <code className="rounded bg-sunken px-1">.env.local</code> file in the
        project root with:
      </p>
      <ul className="mt-5 space-y-3">
        {rows.map(([name, hint, ok]) => (
          <li key={name} className="flex items-start gap-3">
            <span className={`mt-0.5 text-sm ${ok ? "text-good" : "text-warn"}`}>
              {ok ? "●" : "○"}
            </span>
            <div>
              <code className="text-sm font-semibold">{name}</code>
              <p className="text-xs text-faint">{hint}</p>
            </div>
          </li>
        ))}
        <li className="flex items-start gap-3">
          <span className={`mt-0.5 text-sm ${mongoOk ? "text-good" : "text-warn"}`}>
            {mongoOk ? "●" : "○"}
          </span>
          <div>
            <span className="text-sm font-semibold">MongoDB reachable</span>
            <p className="text-xs text-faint">The app could {mongoOk ? "" : "not "}connect.</p>
          </div>
        </li>
      </ul>
      <p className="mt-5 text-xs text-faint">Restart the dev server after editing .env.local.</p>
    </div>
  );
}
