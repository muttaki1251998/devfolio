"use client";

import { type AppStatus, ticketUrl } from "@/components/useData";

/** Ticket key that links to the issue on the configured Jira site, in a new tab. */
export default function TicketLink({
  status,
  ticket,
  className = "",
}: {
  status: AppStatus | null;
  ticket: string;
  className?: string;
}) {
  const href = ticketUrl(status, ticket);
  if (!href) return <span className={className}>{ticket}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${className} underline-offset-2 hover:text-deep hover:underline`}
    >
      {ticket}
    </a>
  );
}
