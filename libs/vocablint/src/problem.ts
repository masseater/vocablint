import { Array as Arr, Order, Schema } from "effect";
import type ts from "typescript-6";

import { columnOf, lineOf } from "./syntax.ts";

const RuleNameSchema = Schema.Literals([
  "owner-annotation",
  "duplicate-value-set",
  "owner-value-set",
  "owner-extension",
  "owned-literal",
  "library-value-set",
  "library-shape",
]);

type RuleName = typeof RuleNameSchema.Type;

const ProblemSchema = Schema.Struct({
  file: Schema.String,
  line: Schema.Int,
  column: Schema.Int,
  rule: RuleNameSchema,
  message: Schema.String,
});

type Problem = typeof ProblemSchema.Type;

const ProblemList = Schema.Array(ProblemSchema);

interface Finding {
  readonly rule: RuleName;
  readonly message: string;
}

const problemAt =
  ({ rule, message }: Finding) =>
  (node: ts.Node): Problem => ({
    file: node.getSourceFile().fileName,
    line: lineOf(node),
    column: columnOf(node),
    rule,
    message,
  });

const problemOrder: Order.Order<Problem> = Order.combineAll([
  Order.mapInput(Order.String, (problem: Problem) => problem.file),
  Order.mapInput(Order.Number, (problem: Problem) => problem.line),
  Order.mapInput(Order.Number, (problem: Problem) => problem.column),
  Order.mapInput(Order.String, (problem: Problem) => problem.rule),
  Order.mapInput(Order.String, (problem: Problem) => problem.message),
]);

const problemKey = (problem: Problem): string =>
  [problem.file, problem.line, problem.column, problem.rule, problem.message].join("\0");

const sortProblems = (problems: readonly Problem[]): readonly Problem[] =>
  Arr.sort(
    Arr.dedupeWith(problems, (left, right) => problemKey(left) === problemKey(right)),
    problemOrder,
  );

const formatProblem =
  (relative: (file: string) => string) =>
  (problem: Problem): string =>
    `${relative(problem.file)}:${String(problem.line)}:${String(problem.column)} [${problem.rule}] ${problem.message}`;

export { ProblemList, formatProblem, problemAt, problemKey, sortProblems };
export type { Finding, Problem, RuleName };
