import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import { authRelations } from "#/shared/auth/generated/auth.table";

const db = drizzle(env.DB, { relations: authRelations });

export { db };
