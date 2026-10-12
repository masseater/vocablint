import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import type { Option } from "effect";

class RepositoryFiles extends Context.Service<
  RepositoryFiles,
  {
    readonly readFile: (file: string) => Effect.Effect<Option.Option<string>>;
    readonly exists: (file: string) => Effect.Effect<boolean>;
    readonly readDirectory: (directory: string) => Effect.Effect<readonly string[]>;
    readonly isDirectory: (file: string) => Effect.Effect<Option.Option<boolean>>;
    readonly join: (...segments: readonly string[]) => string;
    readonly resolve: (...segments: readonly string[]) => string;
    readonly relative: (from: string, to: string) => string;
    readonly dirname: (file: string) => string;
    readonly basename: (file: string) => string;
  }
>()("@vocablint/core/repository-files/RepositoryFiles") {}

const nodeRepositoryFiles = Layer.effect(
  RepositoryFiles,
  Effect.gen(function* nodeRepositoryFiles() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return RepositoryFiles.of({
      readFile: (file) => fs.readFileString(file).pipe(Effect.option),
      exists: (file) => fs.exists(file).pipe(Effect.orElseSucceed(() => false)),
      readDirectory: (directory) =>
        fs.readDirectory(directory).pipe(Effect.orElseSucceed((): readonly string[] => [])),
      isDirectory: (file) =>
        fs.stat(file).pipe(
          Effect.map((info) => info.type === "Directory"),
          Effect.option,
        ),
      join: (...segments) => path.join(...segments),
      resolve: (...segments) => path.resolve(...segments),
      relative: (from, to) => path.relative(from, to),
      dirname: (file) => path.dirname(file),
      basename: (file) => path.basename(file),
    });
  }),
).pipe(Layer.provide(nodeServicesLayer));

export { RepositoryFiles, nodeRepositoryFiles };
