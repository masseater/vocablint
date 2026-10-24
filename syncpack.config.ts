import { Array as Arr, Record as Rec, pipe } from "effect";
import type { RcFile } from "syncpack";

import { requiredStack } from "./lint.config.ts";

const config: RcFile = {
  versionGroups: pipe(
    Rec.toEntries(requiredStack),
    Arr.map(([label, dependencies]) => ({
      label,
      dependencies: [...dependencies],
      isBanned: true,
    })),
  ),
};

export default config;
