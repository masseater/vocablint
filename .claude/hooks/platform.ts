import { Context } from "effect";
import type { Effect, FileSystem, Option, Path, Schema, Stdio } from "effect";

interface CommandResult {
  readonly succeeded: boolean;
  readonly stdout: string;
  readonly output: string;
}

class HookPlatform extends Context.Service<
  HookPlatform,
  {
    readonly runCommand: (command: string, args: readonly string[]) => Effect.Effect<CommandResult>;
    readonly getJson: <Codec extends Schema.Top>(
      url: string,
      schema: Codec,
    ) => Effect.Effect<Option.Option<Codec["Type"]>, never, Codec["DecodingServices"]>;
  }
>()("claude-harness/hooks/platform/HookPlatform") {}

type HookServices = HookPlatform | FileSystem.FileSystem | Path.Path | Stdio.Stdio;

export { HookPlatform };
export type { CommandResult, HookServices };
