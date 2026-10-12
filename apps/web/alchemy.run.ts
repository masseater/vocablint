import { Stack, makeRandom } from "alchemy";
import { D1, Website, providers, state } from "alchemy/Cloudflare";
import type { InferEnv } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { APP_NAME, requireAppPrefix } from "./app-name.ts";

const TRACE_SAMPLING_RATE = 0.1;

const web = Effect.gen(function* web() {
  const DB = yield* D1.Database("DB", { migrations: "./drizzle" });
  const BETTER_AUTH_SECRET = yield* makeRandom("BetterAuthSecret");
  return yield* Website.Vite("Web", {
    compatibility: { date: "2026-08-25" },
    env: { BETTER_AUTH_SECRET, DB },
    observability: {
      enabled: true,
      logs: {
        enabled: true,
        invocationLogs: true,
        persist: true,
      },
      traces: { enabled: true, headSamplingRate: TRACE_SAMPLING_RATE, persist: true },
    },
    viteEnvironments: { entry: "ssr", children: ["rsc"] },
  });
});

type WebEnv = InferEnv<typeof web>;

export type { WebEnv };
export default Stack(
  APP_NAME,
  { providers: providers(), state: state() },
  Effect.gen(function* stack() {
    const { url } = yield* web;
    yield* requireAppPrefix;
    return { url };
  }),
);
