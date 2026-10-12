import { formatHeaders } from "@distilled.cloud/cloudflare/Credentials";
import { NodeServices } from "@effect/platform-node";
import { AuthProviders } from "alchemy";
import { CloudflareApiLive, Credentials } from "alchemy/Cloudflare";
import { Effect, Layer, Schema } from "effect";

import { runHookWith, writeJson } from "./env.ts";

const Headers = Schema.Record(Schema.String, Schema.String);

const cloudflareApi = CloudflareApiLive().pipe(
  Layer.provide(Layer.succeed(AuthProviders, {})),
  Layer.provide(NodeServices.layer),
);

runHookWith(cloudflareApi)(
  Effect.gen(function* cloudflareMcpHeaders() {
    const resolve = yield* Credentials;
    yield* writeJson(Headers, formatHeaders(yield* resolve));
  }),
);
