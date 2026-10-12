import type { ReactNode } from "react";

import type { todo } from "#/pages/home/model/todo.table";
import { cn } from "#/shared/lib/utils";

const TodoItem = ({ item }: Readonly<{ item: Readonly<typeof todo.$inferSelect> }>): ReactNode => (
  <li className={cn("py-1", item.status === "done" && "text-muted-foreground line-through")}>
    {item.title}
  </li>
);

export { TodoItem };
