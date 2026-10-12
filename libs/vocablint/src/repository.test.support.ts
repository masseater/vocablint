import { Effect, FileSystem, Path } from "effect";

import { checkRepository } from "./check.ts";

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
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "vocablint-" });
  yield* Effect.forEach(
    Object.entries(files),
    ([fileName, source]) =>
      Effect.gen(function* writeFixture() {
        const absolutePath = path.join(root, fileName);
        yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
        yield* fs.writeFileString(absolutePath, source);
      }),
    { discard: true },
  );
  return root;
});

const fixtureRepository = Effect.fn("fixtureRepository")(function* fixtureRepository(
  files: Readonly<Record<string, string>>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* directoryWith({ ...DEFAULT_FILES, ...files });
  yield* fs.makeDirectory(path.join(root, "node_modules"), { recursive: true });
  yield* fs.symlink(
    path.resolve(import.meta.dirname, "..", "node_modules", "effect"),
    path.join(root, "node_modules", "effect"),
  );
  return root;
});

const findingsIn = Effect.fn("findingsIn")(function* findingsIn(
  files: Readonly<Record<string, string>>,
) {
  const path = yield* Path.Path;
  const root = yield* fixtureRepository(files);
  const problems = yield* checkRepository(root);
  return problems.map(
    (problem) => `${path.relative(root, problem.file)}:${String(problem.line)} ${problem.rule}`,
  );
});

export { directoryWith, findingsIn };
