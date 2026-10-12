import { queryOptions } from "@tanstack/react-query";

import { authClient } from "#/shared/auth";

const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: () => authClient.getSession({ fetchOptions: { throw: true } }),
});

export { sessionQuery };
