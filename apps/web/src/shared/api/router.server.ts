import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

const createRouter = <const Prefix extends string>(prefix: Prefix): Elysia<Prefix> =>
  new Elysia({ prefix, adapter: CloudflareAdapter, aot: false });

export { createRouter };
