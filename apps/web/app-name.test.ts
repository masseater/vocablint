import { Stack } from "alchemy";
import { D1 } from "alchemy/Cloudflare";
import { Stage } from "alchemy/Stage";
import { inMemoryState } from "alchemy/State";
import { Effect, Exit, Layer } from "effect";
import { expect, test } from "vite-plus/test";

import { APP_NAME, requireAppPrefix } from "./app-name.ts";

const deploys = (stackName: string, props: Readonly<{ name?: string }>): Promise<boolean> =>
  Effect.runPromise(
    Stack(
      stackName,
      { providers: Layer.empty, state: inMemoryState() },
      Effect.gen(function* stack() {
        yield* D1.Database("DB", props);
        yield* requireAppPrefix;
      }),
    ).pipe(
      Effect.provideService(Stage, "test"),
      Effect.scoped,
      Effect.exit,
      Effect.map(Exit.isSuccess),
    ),
  );

test.each([
  { stackName: APP_NAME, props: {}, expected: true },
  { stackName: APP_NAME, props: { name: `${APP_NAME}-db` }, expected: true },
  { stackName: APP_NAME, props: { name: "web-db" }, expected: false },
  { stackName: "web", props: {}, expected: false },
])("stack $stackName with $props deploys: $expected", ({ stackName, props, expected }) =>
  expect(deploys(stackName, props)).resolves.toBe(expected),
);
