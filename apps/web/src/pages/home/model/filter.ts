import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";

import type { todo } from "./todo.table";

type TodoFilter = "all" | (typeof todo.$inferSelect)["status"];

const todoFilterAtom = Atom.make<TodoFilter>("all");

const useTodoFilter = (): TodoFilter => useAtomValue(todoFilterAtom);

const useSelectTodoFilter = (): ((filter: TodoFilter) => void) => useAtomSet(todoFilterAtom);

export type { TodoFilter };
export { useSelectTodoFilter, useTodoFilter };
