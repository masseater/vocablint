import { Array as Arr, Effect, Schema, String as Str, pipe } from "effect";

import {
  blockWhen,
  localBin,
  projectRoot,
  readHookInput,
  runCommand,
  runHook,
  writeJson,
} from "./env.ts";
import { HookPlatform } from "./platform.ts";
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
  const platform = yield* HookPlatform;
  const root = yield* projectRoot;
  const [scope, name = ""] = Str.split(platform.sep)(platform.relative(root, filePath));
  const candidates = Arr.filter([scope, platform.join(scope, name)], (dir) => dir !== "");
  return { candidates, root };
});

const fallowTargets = Effect.fn("fallowTargets")(function* fallowTargets(
  root: string,
  candidates: readonly string[],
) {
  const platform = yield* HookPlatform;
  const withConfig = yield* pipe(
    candidates,
    Effect.filter((dir: string) => platform.exists(platform.join(root, dir, ".fallowrc.jsonc"))),
  );
  return [
    [],
    ...pipe(
      withConfig,
      Arr.map((dir) => ["-r", dir]),
    ),
  ];
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
  yield* blockWhen(
    pipe(
      runs,
      Arr.filter((run) => !run.succeeded),
      Arr.map((run) => run.output),
    ),
  );
  return runs;
});

const reportDuplication = (
  runs: readonly CommandResult[],
): Effect.Effect<void, never, HookPlatform> => {
  const duplication = pipe(
    runs,
    Arr.flatMap((run) => Str.split("\n")(run.stdout)),
    Arr.filter(Str.startsWith("code-duplication:")),
    Arr.dedupe,
  );
  if (!Arr.isArrayNonEmpty(duplication)) {
    return Effect.void;
  }
  return writeJson(PostToolUseOutput, {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: Arr.join(
        ["fallow が重複を検出した。共通化すべきか判断すること。", ...duplication],
        "\n",
      ),
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
