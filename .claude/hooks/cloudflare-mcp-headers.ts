import { CloudflareApiLive, Credentials } from "@alchemy.run/cloudflare";
import { formatHeaders } from "@distilled.cloud/cloudflare/Credentials";
import { NodeServices } from "@effect/platform-node";
import { AuthProviders } from "alchemy";
import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

import { runHookWith, writeJson } from "./env.ts";

const Headers = Schema.Record(Schema.String, Schema.String);

const cloudflareApi = CloudflareApiLive().pipe(
  Layer.provide(Layer.succeed(AuthProviders, {})),
  Layer.provide(NodeServices.layer),
  Layer.provide(FetchHttpClient.layer),
);

runHookWith(cloudflareApi)(
  Effect.gen(function* cloudflareMcpHeaders() {
    const resolve = yield* Credentials;
    yield* writeJson(Headers, formatHeaders(yield* resolve));
  }),
);
