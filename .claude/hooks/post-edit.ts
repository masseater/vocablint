import { Array as Arr, Effect, FileSystem, Path, Schema, pipe } from "effect";
import type { Stdio } from "effect";

import {
  blockWhen,
  localBin,
  projectRoot,
  readHookInput,
  runCommand,
  runHook,
  writeJson,
} from "./env.ts";
import type { CommandResult } from "./platform.ts";

const PostToolUseInput = Schema.Struct({
  tool_input: Schema.Struct({ file_path: Schema.optional(Schema.String) }),
});

const PostToolUseOutput = Schema.Struct({
  hookSpecificOutput: Schema.Struct({
    hookEventName: Schema.Literal("PostToolUse"),
    additionalContext: Schema.String,
  }),
});

const locate = Effect.fn("locate")(function* locate(filePath: string) {
  const path = yield* Path.Path;
  const root = yield* projectRoot;
  const [scope = "", name = ""] = path.relative(root, filePath).split(path.sep);
  const candidates = [scope, path.join(scope, name)].filter((dir) => dir !== "");
  return { candidates, root };
});

const fallowTargets = Effect.fn("fallowTargets")(function* fallowTargets(
  root: string,
  candidates: readonly string[],
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const withConfig = yield* pipe(
    candidates,
    Effect.filter((dir: string) =>
      fs.exists(path.join(root, dir, ".fallowrc.jsonc")).pipe(Effect.orDie),
    ),
  );
  return [[], ...withConfig.map((dir) => ["-r", dir])];
});

const runFallow = Effect.fn("runFallow")(function* runFallow(
  root: string,
  candidates: readonly string[],
) {
  const fallow = yield* localBin("fallow");
  const targets = yield* fallowTargets(root, candidates);
  const runs = yield* Effect.forEach(
    targets,
    (args) =>
      runCommand(fallow, ["--changed-since", "HEAD", "--quiet", "--format", "compact", ...args]),
    { concurrency: "unbounded" },
  );
  yield* blockWhen(runs.filter((run) => !run.succeeded).map((run) => run.output));
  return runs;
});

const reportDuplication = (
  runs: readonly CommandResult[],
): Effect.Effect<void, never, Stdio.Stdio> => {
  const duplication = Arr.dedupe(
    runs
      .flatMap((run) => run.stdout.split("\n"))
      .filter((line) => line.startsWith("code-duplication:")),
  );
  if (!Arr.isArrayNonEmpty(duplication)) {
    return Effect.void;
  }
  return writeJson(PostToolUseOutput, {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: [
        "fallow が重複を検出した。共通化すべきか判断すること。",
        ...duplication,
      ].join("\n"),
    },
  });
};

runHook(
  Effect.gen(function* postEdit() {
    const input = yield* readHookInput(PostToolUseInput);
    const filePath = input.tool_input.file_path ?? "";
    const { candidates, root } = yield* locate(filePath);
    const runs = yield* runFallow(root, candidates);
    yield* reportDuplication(runs);
  }),
);
