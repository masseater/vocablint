import {
  Array as Arr,
  Effect,
  Option,
  Order,
  Predicate,
  Schema,
  String as Str,
  Record as Rec,
  pipe,
} from "effect";

import { RepositoryFiles } from "./repository-files.ts";

interface DependencyEntry {
  readonly packageName: string;
  readonly specifier: string;
  readonly declarationsPath: string;
}

const DependencyMap = Schema.optional(Schema.Record(Schema.String, Schema.String));

const PackageManifest = Schema.Struct({
  name: Schema.optional(Schema.String),
  dependencies: DependencyMap,
  devDependencies: DependencyMap,
  peerDependencies: DependencyMap,
  exports: Schema.optional(Schema.Unknown),
  types: Schema.optional(Schema.String),
  typings: Schema.optional(Schema.String),
  main: Schema.optional(Schema.String),
});

type Manifest = typeof PackageManifest.Type;

const MANIFEST_FILE = "package.json";
const NODE_MODULES = "node_modules";
const WORKSPACE_PROTOCOL = "workspace:";
const ROOT_SUBPATH = ".";
const SUBPATH_PREFIX = "./";
const WILDCARD = "*";
const TYPES_CONDITION = "types";
const TYPES_SCOPE = "@types/";
const TYPES_SCOPE_SEPARATOR = "__";
const CONDITION_DEPTH_LIMIT = 8;
const ROOT_DEPTH = 0;
const DEPTH_STEP = 1;
const DECLARATIONS_SUFFIX = /\.d\.[cm]?ts$|\.[cm]?tsx?$/u;
const SCRIPT_SUFFIX = /\.(?<module>[cm]?)js$/u;

const readManifest = Effect.fn("readManifest")(function* readManifest(directory: string) {
  const files = yield* RepositoryFiles;
  const text = yield* Effect.fromOption(
    yield* files.readFile(files.join(directory, MANIFEST_FILE)),
  );
  return yield* Schema.decodeEffect(Schema.fromJsonString(PackageManifest))(text);
}, Effect.option);

const conditionsOf = (held: unknown): readonly (readonly [string, unknown])[] => {
  if (!Predicate.isObject(held)) {
    return [];
  }
  return Rec.toEntries(held);
};

const typesConditionIn = (held: unknown, depth: number): Option.Option<string> => {
  if (depth > CONDITION_DEPTH_LIMIT) {
    return Option.none();
  }
  const entries = conditionsOf(held);
  const declared = Arr.findFirst(entries, ([condition, target]) =>
    Option.liftPredicate(
      target,
      (candidate) => condition === TYPES_CONDITION && Predicate.isString(candidate),
    ),
  ).pipe(Option.filter(Predicate.isString));
  return Option.orElse(declared, () =>
    Arr.findFirst(entries, ([, nested]) => typesConditionIn(nested, depth + DEPTH_STEP)),
  );
};

const anyConditionIn = (held: unknown, depth: number): Option.Option<string> => {
  if (Predicate.isString(held)) {
    return Option.some(held);
  }
  if (depth > CONDITION_DEPTH_LIMIT) {
    return Option.none();
  }
  return Arr.findFirst(conditionsOf(held), ([, nested]) =>
    anyConditionIn(nested, depth + DEPTH_STEP),
  );
};

const targetPathsOf = (target: unknown): readonly string[] =>
  Arr.getSomes([typesConditionIn(target, ROOT_DEPTH), anyConditionIn(target, ROOT_DEPTH)]);

interface SubpathTarget {
  readonly subpath: string;
  readonly target: unknown;
}

const subpathTargetsOf = (exportsField: unknown): readonly SubpathTarget[] => {
  if (Predicate.isString(exportsField)) {
    return [{ subpath: ROOT_SUBPATH, target: exportsField }];
  }
  const entries = conditionsOf(exportsField);
  if (
    !pipe(
      entries,
      Arr.some(([subpath]) => Str.startsWith(ROOT_SUBPATH)(subpath)),
    )
  ) {
    return Arr.match(entries, {
      onEmpty: () => [],
      onNonEmpty: () => [{ subpath: ROOT_SUBPATH, target: exportsField }],
    });
  }
  return pipe(
    entries,
    Arr.filter(([subpath]) => subpath === ROOT_SUBPATH || Str.startsWith(SUBPATH_PREFIX)(subpath)),
    Arr.filter(([subpath]) => !Str.includes(WILDCARD)(subpath)),
    Arr.map(([subpath, target]) => ({ subpath, target })),
  );
};

const declarationsCandidateFor = (entryPath: string): Option.Option<string> => {
  if (DECLARATIONS_SUFFIX.test(entryPath)) {
    return Option.some(entryPath);
  }
  if (!SCRIPT_SUFFIX.test(entryPath)) {
    return Option.none();
  }
  return Option.some(Str.replace(SCRIPT_SUFFIX, ".d.$<module>ts")(entryPath));
};

const firstDeclarationsAmong = Effect.fn("firstDeclarationsAmong")(function* firstDeclarations(
  directory: string,
  entryPaths: readonly string[],
) {
  const files = yield* RepositoryFiles;
  const candidates = Arr.getSomes(
    pipe(
      entryPaths,
      Arr.map((entryPath) => declarationsCandidateFor(entryPath)),
    ),
  );
  const existing = yield* Effect.filter(
    pipe(
      candidates,
      Arr.map((candidate) => files.join(directory, candidate)),
    ),
    (candidate) => files.exists(candidate),
  );
  return Arr.head(existing);
});

const importNameOf = (packageName: string): string => {
  if (!Str.startsWith(TYPES_SCOPE)(packageName)) {
    return packageName;
  }
  const unscoped = Str.slice(TYPES_SCOPE.length)(packageName);
  if (!Str.includes(TYPES_SCOPE_SEPARATOR)(unscoped)) {
    return unscoped;
  }
  return `@${Str.replace(TYPES_SCOPE_SEPARATOR, "/")(unscoped)}`;
};

const specifierFor = (packageName: string, subpath: string): string => {
  const importName = importNameOf(packageName);
  if (subpath === ROOT_SUBPATH) {
    return importName;
  }
  return `${importName}/${Str.slice(SUBPATH_PREFIX.length)(subpath)}`;
};

const rootEntryPaths = (manifest: Manifest): readonly string[] =>
  Arr.getSomes([
    Option.fromUndefinedOr(manifest.types),
    Option.fromUndefinedOr(manifest.typings),
    Option.fromUndefinedOr(manifest.main),
  ]);

const subpathEntriesOf = Effect.fn("subpathEntriesOf")(function* subpathEntriesOf(
  packageName: string,
  directory: string,
  manifest: Manifest,
) {
  const found = yield* Effect.forEach(subpathTargetsOf(manifest.exports), ({ subpath, target }) =>
    firstDeclarationsAmong(directory, targetPathsOf(target)).pipe(
      Effect.map(
        Option.map((declarationsPath) => ({
          packageName,
          specifier: specifierFor(packageName, subpath),
          declarationsPath,
        })),
      ),
    ),
  );
  return Arr.getSomes(found);
});

const entriesOfDependency = Effect.fn("entriesOfDependency")(function* entriesOfDependency(
  packageName: string,
  directory: string,
) {
  const manifest = yield* readManifest(directory);
  if (Option.isNone(manifest)) {
    return [];
  }
  const subpathEntries = yield* subpathEntriesOf(packageName, directory, manifest.value);
  const rootSpecifier = specifierFor(packageName, ROOT_SUBPATH);
  if (
    pipe(
      subpathEntries,
      Arr.some((entry) => entry.specifier === rootSpecifier),
    )
  ) {
    return subpathEntries;
  }
  const rootDeclarations = yield* firstDeclarationsAmong(directory, rootEntryPaths(manifest.value));
  const rootEntries = rootDeclarations.pipe(
    Option.map((declarationsPath) => ({ packageName, specifier: rootSpecifier, declarationsPath })),
    Option.toArray,
  );
  return [...rootEntries, ...subpathEntries];
});

const declaredDependencies = (manifest: Manifest): readonly string[] =>
  pipe(
    Rec.toEntries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    }),
    Arr.filter(([, range]) => !Str.startsWith(WORKSPACE_PROTOCOL)(range)),
    Arr.map(([packageName]) => packageName),
  );

const workspaceDependencies = (manifest: Manifest): readonly string[] =>
  pipe(
    Rec.toEntries({ ...manifest.dependencies, ...manifest.devDependencies }),
    Arr.filter(([, range]) => Str.startsWith(WORKSPACE_PROTOCOL)(range)),
    Arr.map(([packageName]) => packageName),
  );

const entryOrder = Order.mapInput(Order.String, (entry: DependencyEntry) => entry.specifier);

const dependencyEntries = Effect.fn("dependencyEntries")(function* dependencyEntries(
  packageDirectory: string,
) {
  const files = yield* RepositoryFiles;
  const manifest = yield* readManifest(packageDirectory);
  if (Option.isNone(manifest)) {
    return [];
  }
  const entries = yield* Effect.forEach(declaredDependencies(manifest.value), (packageName) =>
    entriesOfDependency(packageName, files.join(packageDirectory, NODE_MODULES, packageName)),
  );
  return Arr.sort(
    Arr.dedupeWith(entries.flat(), (left, right) => left.specifier === right.specifier),
    entryOrder,
  );
});

export { MANIFEST_FILE, NODE_MODULES, dependencyEntries, readManifest, workspaceDependencies };
export type { DependencyEntry, Manifest };
