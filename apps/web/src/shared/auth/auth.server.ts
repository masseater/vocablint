import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";

import { db } from "#/shared/db/client.server";

import { account, authRelations, session, user, verification } from "./generated/auth.table";

const auth = betterAuth({
  baseURL: { allowedHosts: ["*.workers.dev", "localhost:*"] },
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { account, authRelations, session, user, verification },
  }),
  emailAndPassword: { enabled: true },
  plugins: [tanstackStartCookies()],
  secret: env.BETTER_AUTH_SECRET,
});

export { auth };
