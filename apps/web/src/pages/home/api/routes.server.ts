import { Effect } from "effect";

import { todo } from "#/pages/home/model/todo.table";
import { createRouter } from "#/shared/api/index.server";
import { db } from "#/shared/db/index.server";
import { FeatureFlags } from "#/shared/flags/index.server";

import { runRequest } from "./runtime.server";

const listTodos = Effect.gen(function* listTodos() {
  const flags = yield* FeatureFlags;
  const includeDone = yield* flags.getBoolean("show-done-todos", true);
  const rows = yield* Effect.promise(() => db.select().from(todo));
  yield* Effect.logInfo("todos listed").pipe(
    Effect.annotateLogs({ includeDone, total: rows.length }),
  );
  if (includeDone) {
    return rows;
  }
  return rows.filter((row) => row.status === "open");
}).pipe(Effect.withSpan("todo.list"));

const todoRoutes = createRouter("/api/todos").get("/", () => runRequest(listTodos));

type TodoRoutes = typeof todoRoutes;

export type { TodoRoutes };
export { todoRoutes };
