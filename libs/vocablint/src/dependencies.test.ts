import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import { dependencyEntries } from "./dependencies.ts";
import { directoryWith } from "./repository.test.support.ts";

interface RelativeEntry {
  readonly specifier: string;
  readonly declarationsPath: string;
}

const manifest = (fields: object): string => JSON.stringify(fields);

const relativeEntries = (
  packageDirectory: string,
): Effect.Effect<readonly RelativeEntry[], never, FileSystem.FileSystem | Path.Path> =>
  dependencyEntries(packageDirectory).pipe(
    Effect.map((entries) =>
      entries.map((entry) => ({
        specifier: entry.specifier,
        declarationsPath: entry.declarationsPath.slice(`${packageDirectory}/`.length),
      })),
    ),
  );

const EMPTY_DECLARATIONS = "export {};\n";

const readsTheRootTypesConditionOfAnExportMap = Effect.gen(
  function* readsTheRootTypesConditionOfAnExportMap() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({ dependencies: { oxlint: "1.0.0" } }),
      "node_modules/oxlint/package.json": manifest({
        exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
      }),
      "node_modules/oxlint/dist/index.d.ts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([
      { specifier: "oxlint", declarationsPath: "node_modules/oxlint/dist/index.d.ts" },
    ]);
  },
);

const readsAnExportMapSpelledAsOnePathAsTheRoo = Effect.gen(
  function* readsAnExportMapSpelledAsOnePathAsTheRoo() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({ dependencies: { oxlint: "1.0.0" } }),
      "node_modules/oxlint/package.json": manifest({ exports: "./dist/index.js" }),
      "node_modules/oxlint/dist/index.d.ts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([
      { specifier: "oxlint", declarationsPath: "node_modules/oxlint/dist/index.d.ts" },
    ]);
  },
);

const readsConditionsWrittenWithoutASubpathAsT = Effect.gen(
  function* readsConditionsWrittenWithoutASubpathAsT() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({ dependencies: { oxlint: "1.0.0" } }),
      "node_modules/oxlint/package.json": manifest({
        exports: { import: { types: "./dist/index.d.mts" } },
      }),
      "node_modules/oxlint/dist/index.d.mts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([
      { specifier: "oxlint", declarationsPath: "node_modules/oxlint/dist/index.d.mts" },
    ]);
  },
);

const readsEveryPublishedSubpathAndLeavesWildc = Effect.gen(
  function* readsEveryPublishedSubpathAndLeavesWildc() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({ dependencies: { effect: "4.0.0" } }),
      "node_modules/effect/package.json": manifest({
        exports: {
          ".": { types: "./dist/index.d.ts" },
          "./encoding": { types: "./dist/encoding.d.ts" },
          "./internal/*": { types: "./dist/internal/*.d.ts" },
          "./package.json": "./package.json",
        },
      }),
      "node_modules/effect/dist/index.d.ts": EMPTY_DECLARATIONS,
      "node_modules/effect/dist/encoding.d.ts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([
      { specifier: "effect", declarationsPath: "node_modules/effect/dist/index.d.ts" },
      {
        specifier: "effect/encoding",
        declarationsPath: "node_modules/effect/dist/encoding.d.ts",
      },
    ]);
  },
);

const letsTheTypesFieldNameTheRootWhenTheExpor = Effect.gen(
  function* letsTheTypesFieldNameTheRootWhenTheExpor() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({ dependencies: { oxlint: "1.0.0" } }),
      "node_modules/oxlint/package.json": manifest({
        types: "./index.d.ts",
        exports: { "./plugins": { types: "./plugins.d.ts" } },
      }),
      "node_modules/oxlint/index.d.ts": EMPTY_DECLARATIONS,
      "node_modules/oxlint/plugins.d.ts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([
      { specifier: "oxlint", declarationsPath: "node_modules/oxlint/index.d.ts" },
      { specifier: "oxlint/plugins", declarationsPath: "node_modules/oxlint/plugins.d.ts" },
    ]);
  },
);

const letsTheTypesFieldDecideWhenTheExportMapN = Effect.gen(
  function* letsTheTypesFieldDecideWhenTheExportMapN() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({ dependencies: { oxlint: "1.0.0", vite: "1.0.0" } }),
      "node_modules/oxlint/package.json": '{"types":"./index.d.ts","exports":{".":{"node":null}}}',
      "node_modules/oxlint/index.d.ts": EMPTY_DECLARATIONS,
      "node_modules/vite/package.json": manifest({
        typings: "./types.d.ts",
        exports: { ".": "./bin/vite" },
      }),
      "node_modules/vite/types.d.ts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([
      { specifier: "oxlint", declarationsPath: "node_modules/oxlint/index.d.ts" },
      { specifier: "vite", declarationsPath: "node_modules/vite/types.d.ts" },
    ]);
  },
);

const findsATypesConditionNestedUnderAnotherCo = Effect.gen(
  function* findsATypesConditionNestedUnderAnotherCo() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({ dependencies: { oxlint: "1.0.0" } }),
      "node_modules/oxlint/package.json": manifest({
        exports: {
          ".": { import: { types: "./dist/index.d.mts", default: "./dist/index.mjs" } },
        },
      }),
      "node_modules/oxlint/dist/index.d.mts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([
      { specifier: "oxlint", declarationsPath: "node_modules/oxlint/dist/index.d.mts" },
    ]);
  },
);

const pointsARuntimeOnlyMainEntryAtTheDeclarat = Effect.gen(
  function* pointsARuntimeOnlyMainEntryAtTheDeclarat() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({ dependencies: { nested: "1.0.0" } }),
      "node_modules/nested/package.json": manifest({ main: "./lib/main.cjs" }),
      "node_modules/nested/lib/main.d.cts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([
      { specifier: "nested", declarationsPath: "node_modules/nested/lib/main.d.cts" },
    ]);
  },
);

const readsDevelopmentAndPeerDependenciesTheSa = Effect.gen(
  function* readsDevelopmentAndPeerDependenciesTheSa() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({
        devDependencies: { oxlint: "1.0.0" },
        peerDependencies: { vite: "1.0.0" },
      }),
      "node_modules/oxlint/package.json": manifest({ types: "./index.d.ts" }),
      "node_modules/oxlint/index.d.ts": EMPTY_DECLARATIONS,
      "node_modules/vite/package.json": manifest({ types: "./index.d.ts" }),
      "node_modules/vite/index.d.ts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([
      { specifier: "oxlint", declarationsPath: "node_modules/oxlint/index.d.ts" },
      { specifier: "vite", declarationsPath: "node_modules/vite/index.d.ts" },
    ]);
  },
);

const leavesWorkspaceDependenciesToTheReposito = Effect.gen(
  function* leavesWorkspaceDependenciesToTheReposito() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({ dependencies: { "@repo/shared": "workspace:*" } }),
      "node_modules/@repo/shared/package.json": manifest({ types: "./index.d.ts" }),
      "node_modules/@repo/shared/index.d.ts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([]);
  },
);

const skipsPackagesThatShipNoDeclarationsOrAre = Effect.gen(
  function* skipsPackagesThatShipNoDeclarationsOrAre() {
    const packageDirectory = yield* directoryWith({
      "package.json": manifest({
        dependencies: { untyped: "1.0.0", absent: "1.0.0", rootonly: "1.0.0" },
      }),
      "node_modules/untyped/package.json": manifest({ main: "./index" }),
      "node_modules/rootonly/package.json": manifest({ types: "./index.d.ts" }),
      "node_modules/rootonly/index.d.ts": EMPTY_DECLARATIONS,
    });
    expect(yield* relativeEntries(packageDirectory)).toStrictEqual([
      { specifier: "rootonly", declarationsPath: "node_modules/rootonly/index.d.ts" },
    ]);
  },
);

const sortsEntriesByPackageName = Effect.gen(function* sortsEntriesByPackageName() {
  const packageDirectory = yield* directoryWith({
    "package.json": manifest({ dependencies: { zod: "1.0.0", alpha: "1.0.0", mid: "1.0.0" } }),
    "node_modules/zod/package.json": manifest({ types: "./index.d.ts" }),
    "node_modules/zod/index.d.ts": EMPTY_DECLARATIONS,
    "node_modules/alpha/package.json": manifest({ types: "./index.d.ts" }),
    "node_modules/alpha/index.d.ts": EMPTY_DECLARATIONS,
    "node_modules/mid/package.json": manifest({ types: "./index.d.ts" }),
    "node_modules/mid/index.d.ts": EMPTY_DECLARATIONS,
  });
  expect((yield* relativeEntries(packageDirectory)).map((entry) => entry.specifier)).toStrictEqual([
    "alpha",
    "mid",
    "zod",
  ]);
});

const hasNothingToOfferWithoutDependenciesOrWi = Effect.gen(
  function* hasNothingToOfferWithoutDependenciesOrWi() {
    const withoutDependencies = yield* directoryWith({ "package.json": manifest({ name: "x" }) });
    const withoutManifest = yield* directoryWith({ "README.md": "" });
    expect(yield* dependencyEntries(withoutDependencies)).toStrictEqual([]);
    expect(yield* dependencyEntries(withoutManifest)).toStrictEqual([]);
  },
);

layer(NodeServices.layer)("dependencyEntries export maps", (it) => {
  it.effect(
    "reads the root types condition of an export map",
    () => readsTheRootTypesConditionOfAnExportMap,
  );
  it.effect(
    "reads an export map spelled as one path as the root",
    () => readsAnExportMapSpelledAsOnePathAsTheRoo,
  );
  it.effect(
    "reads conditions written without a subpath as the root",
    () => readsConditionsWrittenWithoutASubpathAsT,
  );
  it.effect(
    "reads every published subpath and leaves wildcard subpaths out",
    () => readsEveryPublishedSubpathAndLeavesWildc,
  );
  it.effect(
    "lets the types field name the root when the export map names only subpaths",
    () => letsTheTypesFieldNameTheRootWhenTheExpor,
  );
  it.effect(
    "lets the types field decide when the export map names no declarations",
    () => letsTheTypesFieldDecideWhenTheExportMapN,
  );
});

layer(NodeServices.layer)("dependencyEntries manifests", (it) => {
  it.effect(
    "finds a types condition nested under another condition",
    () => findsATypesConditionNestedUnderAnotherCo,
  );
  it.effect(
    "points a runtime-only main entry at the declarations beside it",
    () => pointsARuntimeOnlyMainEntryAtTheDeclarat,
  );
  it.effect(
    "reads development and peer dependencies the same way",
    () => readsDevelopmentAndPeerDependenciesTheSa,
  );
  it.effect(
    "leaves workspace dependencies to the repository catalog",
    () => leavesWorkspaceDependenciesToTheReposito,
  );
  it.effect(
    "skips packages that ship no declarations or are missing from the checkout",
    () => skipsPackagesThatShipNoDeclarationsOrAre,
  );
  it.effect("sorts entries by package name", () => sortsEntriesByPackageName);
  it.effect(
    "has nothing to offer without dependencies or without a manifest",
    () => hasNothingToOfferWithoutDependenciesOrWi,
  );
});
