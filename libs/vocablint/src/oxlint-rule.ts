import type { Diagnostic, Plugin, Rule } from "vite-plus/lint/plugins";

import type { Problem } from "./problem.ts";

type ProblemLoader = (cwd: string) => readonly Problem[];

const COLUMN_BASE = 1;

const diagnosticOf = (problem: Problem): Diagnostic => ({
  message: `[${problem.rule}] ${problem.message}`,
  loc: { start: { line: problem.line, column: problem.column - COLUMN_BASE } },
});

const vocabularyRule = (load: ProblemLoader): Rule => ({
  create: (context) => ({
    Program: () => {
      const problems = load(context.cwd).filter((problem) => problem.file === context.filename);
      for (const problem of problems) {
        context.report(diagnosticOf(problem));
      }
    },
  }),
});

const vocablintPlugin = (load: ProblemLoader): Plugin => ({
  meta: { name: "vocablint" },
  rules: { vocabulary: vocabularyRule(load) },
});

export { vocablintPlugin, vocabularyRule };
export type { ProblemLoader };
