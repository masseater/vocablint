import { createFileRoute } from "@tanstack/react-router";

import { api } from "#/app/server/api.server";

const handle = ({ request }: Readonly<{ request: Request }>): Promise<Response> =>
  api.handle(request);

const Route = createFileRoute("/api/$")({
  server: {
    handlers: { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle },
  },
});

export { Route };
