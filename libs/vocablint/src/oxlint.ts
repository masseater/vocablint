import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Option, Schema } from "effect";

import { JSON_FLAG } from "./cli-contract.ts";
import { vocablintPlugin } from "./oxlint-rule.ts";
import { ProblemList } from "./problem.ts";
import type { Problem } from "./problem.ts";

const CLI_PATH = fileURLToPath(new URL("cli.mjs", import.meta.url));
const decodeProblems = Schema.decodeUnknownSync(Schema.fromJsonString(ProblemList));
const loaded = new Map<string, readonly Problem[]>();

const runCli = (cwd: string): readonly Problem[] =>
  decodeProblems(
    execFileSync(process.execPath, [CLI_PATH, JSON_FLAG], {
      cwd,
      encoding: "utf8",
      maxBuffer: Number.MAX_SAFE_INTEGER,
    }),
  );

const loadProblems = (cwd: string): readonly Problem[] =>
  Option.fromUndefinedOr(loaded.get(cwd)).pipe(
    Option.getOrElse(() => {
      const problems = runCli(cwd);
      loaded.set(cwd, problems);
      return problems;
    }),
  );

export default vocablintPlugin(loadProblems);
