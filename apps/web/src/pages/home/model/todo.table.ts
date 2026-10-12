import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const todo = sqliteTable("todo", {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  status: text({ enum: ["open", "done"] })
    .notNull()
    .default("open"),
});
