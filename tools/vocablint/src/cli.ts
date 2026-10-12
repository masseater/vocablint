import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import {
  ProblemList,
  RepositoryFiles,
  checkRepository,
  formatProblem,
  nodeRepositoryFiles,
} from "@vocablint/core";
import type { Problem } from "@vocablint/core";
import { Cause, Data, Effect, Layer, Option, Schema, Stdio, Stream } from "effect";

import { JSON_FLAG } from "./cli-contract.ts";

class ProblemsFound extends Data.TaggedError("ProblemsFound")<{ readonly count: number }> {}

const NO_PROBLEMS = 0;

const writeStdout = (text: string): Effect.Effect<void, never, Stdio.Stdio> =>
  Effect.gen(function* write() {
    const stdio = yield* Stdio.Stdio;
    yield* Stream.make(text).pipe(Stream.run(stdio.stdout()), Effect.orDie);
  });

const reportText = (
  root: string,
  problems: readonly Problem[],
): Effect.Effect<void, ProblemsFound, RepositoryFiles | Stdio.Stdio> =>
  Effect.gen(function* report() {
    const files = yield* RepositoryFiles;
    const format = formatProblem((file) => files.relative(root, file));
    yield* writeStdout(problems.map((problem) => `${format(problem)}\n`).join(""));
    if (problems.length > NO_PROBLEMS) {
      return yield* new ProblemsFound({ count: problems.length });
    }
    return yield* Effect.void;
  });

const vocablint = Effect.gen(function* vocablint() {
  const stdio = yield* Stdio.Stdio;
  const files = yield* RepositoryFiles;
  const args = yield* stdio.args;
  const root = files.resolve(".");
  const problems = yield* checkRepository(root);
  if (args.includes(JSON_FLAG)) {
    const text = yield* Schema.encodeEffect(Schema.fromJsonString(ProblemList))(problems);
    return yield* writeStdout(text);
  }
  return yield* reportText(root, problems);
});

const reportFailure = <Failure>(
  cause: Cause.Cause<Failure>,
): Effect.Effect<void, never, Stdio.Stdio> =>
  Effect.gen(function* report() {
    const stdio = yield* Stdio.Stdio;
    const failed = Cause.findErrorOption(cause).pipe(
      Option.exists((failure) => failure instanceof ProblemsFound),
    );
    if (failed) {
      return;
    }
    yield* Stream.make(`${Cause.pretty(cause)}\n`).pipe(Stream.run(stdio.stderr()), Effect.orDie);
  });

const runCli = <Value, Failure>(
  program: Effect.Effect<Value, Failure, RepositoryFiles | Stdio.Stdio>,
): void => {
  const main = Layer.build(nodeRepositoryFiles.pipe(Layer.provideMerge(nodeServicesLayer))).pipe(
    Effect.flatMap((context) =>
      Effect.provideContext(program.pipe(Effect.tapCause(reportFailure)), context),
    ),
    Effect.scoped,
  );
  runMain(main, { disableErrorReporting: true });
};

runCli(vocablint);
