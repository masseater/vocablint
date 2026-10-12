import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { sessionQuery } from "#/pages/home/api/session";

const GUEST = "Guest";

const SessionBadge = (): ReactNode => {
  const session = useQuery(sessionQuery);
  if (session.status !== "success" || session.data === null) {
    return <span className="text-muted-foreground text-sm">{GUEST}</span>;
  }
  return <span className="text-sm">{session.data.user.name}</span>;
};

export { SessionBadge };
