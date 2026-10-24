import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import {
  Context,
  Effect,
  FileSystem,
  Layer,
  Path,
  Array as Arr,
  Record as Rec,
  pipe,
} from "effect";
import type { Scope } from "effect";

import { checkRepository } from "./check.ts";
import { RepositoryFiles, nodeRepositoryFiles } from "./repository-files.ts";

class FixtureFiles extends Context.Service<
  FixtureFiles,
  {
    readonly makeTempDirectory: Effect.Effect<string, never, Scope.Scope>;
    readonly writeFile: (file: string, source: string) => Effect.Effect<void>;
    readonly symlink: (target: string, link: string) => Effect.Effect<void>;
  }
>()("@vocablint/core/repository.test.support/FixtureFiles") {}

const fixtureFiles = Layer.effect(
  FixtureFiles,
  Effect.gen(function* fixtureFiles() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const makeParent = (file: string): Effect.Effect<void> =>
      fs.makeDirectory(path.dirname(file), { recursive: true }).pipe(Effect.orDie);
    return FixtureFiles.of({
      makeTempDirectory: fs.makeTempDirectoryScoped({ prefix: "vocablint-" }).pipe(Effect.orDie),
      writeFile: (file, source) =>
        makeParent(file).pipe(Effect.andThen(fs.writeFileString(file, source)), Effect.orDie),
      symlink: (target, link) =>
        makeParent(link).pipe(Effect.andThen(fs.symlink(target, link)), Effect.orDie),
    });
  }),
);

const fixtureLayer = fixtureFiles.pipe(
  Layer.provideMerge(nodeRepositoryFiles),
  Layer.provide(nodeServicesLayer),
);

const DEFAULT_FILES: Readonly<Record<string, string>> = {
  "package.json": JSON.stringify({ name: "fixture" }),
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      strict: true,
      module: "nodenext",
      moduleResolution: "nodenext",
      target: "esnext",
      noEmit: true,
      skipLibCheck: true,
    },
    include: ["src"],
  }),
};

const directoryWith = Effect.fn("directoryWith")(function* directoryWith(
  files: Readonly<Record<string, string>>,
) {
  const fixtures = yield* FixtureFiles;
  const repositoryFiles = yield* RepositoryFiles;
  const root = yield* fixtures.makeTempDirectory;
  yield* Effect.forEach(
    Rec.toEntries(files),
    ([fileName, source]) => fixtures.writeFile(repositoryFiles.join(root, fileName), source),
    { discard: true },
  );
  return root;
});

const fixtureRepository = Effect.fn("fixtureRepository")(function* fixtureRepository(
  files: Readonly<Record<string, string>>,
) {
  const fixtures = yield* FixtureFiles;
  const repositoryFiles = yield* RepositoryFiles;
  const root = yield* directoryWith({ ...DEFAULT_FILES, ...files });
  yield* fixtures.symlink(
    repositoryFiles.resolve(import.meta.dirname, "..", "node_modules", "effect"),
    repositoryFiles.join(root, "node_modules", "effect"),
  );
  return root;
});

const findingsIn = Effect.fn("findingsIn")(function* findingsIn(
  files: Readonly<Record<string, string>>,
) {
  const repositoryFiles = yield* RepositoryFiles;
  const root = yield* fixtureRepository(files);
  const problems = yield* checkRepository(root);
  return pipe(
    problems,
    Arr.map(
      (problem) =>
        `${repositoryFiles.relative(root, problem.file)}:${String(problem.line)} ${problem.rule}`,
    ),
  );
});

export { directoryWith, findingsIn, fixtureLayer };
