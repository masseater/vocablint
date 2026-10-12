import { POSITION_BASE, describeFinding } from "@vocablint/core";
import type { Problem } from "@vocablint/core";
import type { Diagnostic, Plugin, Rule } from "vite-plus/lint/plugins";

type ProblemLoader = (cwd: string) => readonly Problem[];

const diagnosticOf = (problem: Problem): Diagnostic => ({
  message: describeFinding(problem),
  loc: { start: { line: problem.line, column: problem.column - POSITION_BASE } },
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
