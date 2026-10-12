import { OpenFeature, TypedInMemoryProvider } from "@openfeature/server-sdk";
import { Context, Effect, Layer } from "effect";

import { flagConfiguration } from "./flag-configuration";

class FeatureFlags extends Context.Service<
  FeatureFlags,
  {
    readonly getBoolean: (key: string, defaultValue: boolean) => Effect.Effect<boolean>;
  }
>()("web/shared/flags/feature-flags.server/FeatureFlags") {}

const featureFlagsLive = Layer.effect(
  FeatureFlags,
  Effect.gen(function* featureFlags() {
    yield* Effect.promise(() =>
      OpenFeature.setProviderAndWait(new TypedInMemoryProvider(flagConfiguration)),
    );
    const client = OpenFeature.getClient();
    return FeatureFlags.of({
      getBoolean: (key, defaultValue) =>
        Effect.promise(() => client.getBooleanValue(key, defaultValue)),
    });
  }),
);

export { FeatureFlags, featureFlagsLive };
