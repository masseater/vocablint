import { useCallback } from "react";
import type { ReactNode } from "react";

import type { TodoFilter } from "#/pages/home/model/filter";
import { useSelectTodoFilter, useTodoFilter } from "#/pages/home/model/filter";
import { Button } from "#/shared/ui/button";

const variantOf = (selected: boolean): "default" | "outline" => {
  if (selected) {
    return "default";
  }
  return "outline";
};

const FilterTab = ({ filter }: Readonly<{ filter: TodoFilter }>): ReactNode => {
  const current = useTodoFilter();
  const setCurrent = useSelectTodoFilter();
  const select = useCallback(() => {
    setCurrent(filter);
  }, [filter, setCurrent]);
  return (
    <Button size="sm" variant={variantOf(filter === current)} onClick={select}>
      {filter}
    </Button>
  );
};

export { FilterTab };
