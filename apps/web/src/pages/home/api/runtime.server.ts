import { Effect, Layer, Logger, ManagedRuntime } from "effect";

import { featureFlagsLive } from "#/shared/flags/index.server";

import { cloudflareLogger, withCloudflareTracing } from "./tracing.server";

const loggerLive = Logger.layer([cloudflareLogger]);

const runtime = ManagedRuntime.make(Layer.mergeAll(featureFlagsLive, loggerLive));

type Services = ManagedRuntime.ManagedRuntime.Services<typeof runtime>;

const runRequest = <Success>(effect: Effect.Effect<Success, never, Services>): Promise<Success> =>
  effect.pipe(
    Effect.tapCause((cause) => Effect.logError("request failed", cause)),
    withCloudflareTracing,
    (traced) => runtime.runPromise(traced),
  );

export { runRequest };
