import type { Problem } from "@vocablint/core";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

import { vocabularyRule } from "./oxlint-rule.ts";

const CWD = "/repository";
const FLAGGED = "/repository/src/flagged.ts";

const problem: Problem = {
  file: FLAGGED,
  line: 2,
  column: 14,
  rule: "library-value-set",
  message: "The values ascending, descending restate a dependency type.",
};

RuleTester.describe = (text, body): void => {
  describe(text, body);
};
RuleTester.it = (text, body): void => {
  it(text, body);
};

new RuleTester({ cwd: CWD }).run(
  "vocabulary",
  vocabularyRule(() => [problem]),
  {
    valid: [{ code: "type Order = string;\n", filename: "/repository/src/clean.ts" }],
    invalid: [
      {
        code: "const a = 1;\ntype Order = 'ascending' | 'descending';\n",
        filename: FLAGGED,
        errors: [
          {
            message:
              "[library-value-set] The values ascending, descending restate a dependency type.",
            line: 2,
            column: 13,
          },
        ],
      },
    ],
  },
);
