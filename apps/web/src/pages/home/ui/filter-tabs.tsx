import type { ReactNode } from "react";

import type { TodoFilter } from "#/pages/home/model/filter";

import { FilterTab } from "./filter-tab";

const FILTERS: readonly TodoFilter[] = ["all", "open", "done"];

const FilterTabs = (): ReactNode => (
  <div className="flex gap-2">
    {FILTERS.map((filter) => (
      <FilterTab key={filter} filter={filter} />
    ))}
  </div>
);

export { FilterTabs };
