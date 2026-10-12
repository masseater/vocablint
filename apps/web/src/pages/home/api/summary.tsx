import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { renderServerComponent } from "@tanstack/react-start/rsc";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { todo } from "#/pages/home/model/todo.table";
import { TodoSummary } from "#/pages/home/ui/todo-summary";
import { db } from "#/shared/db/index.server";

import { runRequest } from "./runtime.server";

const countByStatus = (status: (typeof todo.$inferSelect)["status"]): Effect.Effect<number> =>
  Effect.promise(() => db.$count(todo, eq(todo.status, status)));

const getTodoSummary = createServerFn({ method: "GET" }).handler(() =>
  runRequest(
    Effect.all([countByStatus("open"), countByStatus("done")], { concurrency: "unbounded" }).pipe(
      Effect.flatMap(([open, done]) =>
        Effect.promise(() => renderServerComponent(<TodoSummary open={open} done={done} />)),
      ),
      Effect.withSpan("todo.summary"),
    ),
  ),
);

const todoSummaryQuery = queryOptions({
  queryKey: ["todo-summary"],
  queryFn: () => getTodoSummary(),
  structuralSharing: false,
});

export { todoSummaryQuery };
