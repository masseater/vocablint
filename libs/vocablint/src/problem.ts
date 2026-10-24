import { Array as Arr, Order, Schema, pipe } from "effect";
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

const CANDIDATE_LIMIT = 3;

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
  pipe(
    [problem.file, String(problem.line), String(problem.column), problem.rule, problem.message],
    Arr.join("\0"),
  );

const sortProblems = (problems: readonly Problem[]): readonly Problem[] =>
  Arr.sort(
    Arr.dedupeWith(problems, (left, right) => problemKey(left) === problemKey(right)),
    problemOrder,
  );

const describeFinding = (problem: Problem): string => `[${problem.rule}] ${problem.message}`;

const formatProblem =
  (relative: (file: string) => string) =>
  (problem: Problem): string =>
    `${relative(problem.file)}:${String(problem.line)}:${String(problem.column)} ${describeFinding(problem)}`;

export { CANDIDATE_LIMIT, ProblemList, describeFinding, formatProblem, problemAt, sortProblems };
export type { Finding, Problem, RuleName };
