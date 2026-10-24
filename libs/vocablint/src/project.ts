import {
  Array as Arr,
  Effect,
  Function as Fn,
  Option,
  Order,
  Predicate,
  String as Str,
  pipe,
} from "effect";
import ts from "typescript-6";

import {
  MANIFEST_FILE,
  NODE_MODULES,
  dependencyEntries,
  readManifest,
  workspaceDependencies,
} from "./dependencies.ts";
import { libraryIndex } from "./library.ts";
import type { LibraryIndex } from "./library.ts";
import { RepositoryFiles } from "./repository-files.ts";

interface Project {
  readonly packageName: Option.Option<string>;
  readonly workspaceDependencies: readonly string[];
  readonly program: ts.Program;
  readonly sourceFiles: readonly ts.SourceFile[];
  readonly library: LibraryIndex;
}

interface PackageInfo {
  readonly directory: string;
  readonly name: Option.Option<string>;
  readonly workspaceDependencies: readonly string[];
}

const CONFIG_FILE = "tsconfig.json";
const HIDDEN_PREFIX = ".";
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([NODE_MODULES, "dist", "coverage"]);

const listConfigFiles = (
  directory: string,
): Effect.Effect<readonly string[], never, RepositoryFiles> =>
  Effect.gen(function* configFilesUnder() {
    const files = yield* RepositoryFiles;
    const names = yield* files.readDirectory(directory);
    const visible = pipe(
      names,
      Arr.filter((name) => !Str.startsWith(HIDDEN_PREFIX)(name) && !SKIPPED_DIRECTORIES.has(name)),
      Arr.map((name) => files.join(directory, name)),
    );
    const nested = yield* Fn.pipe(
      visible,
      Effect.forEach((entryPath) =>
        files.isDirectory(entryPath).pipe(
          Effect.flatMap(
            Option.match({
              onNone: (): Effect.Effect<readonly string[], never, RepositoryFiles> =>
                Effect.succeed([]),
              onSome: (
                directoryEntry,
              ): Effect.Effect<readonly string[], never, RepositoryFiles> => {
                if (directoryEntry) {
                  return listConfigFiles(entryPath);
                }
                return Effect.succeed(
                  Arr.filter([entryPath], () => files.basename(entryPath) === CONFIG_FILE),
                );
              },
            }),
          ),
        ),
      ),
    );
    return Arr.sort(nested.flat(), Order.String);
  });

const configHost: ts.ParseConfigFileHost = {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: Fn.constVoid,
};

const parseConfig = (configPath: string): Option.Option<ts.ParsedCommandLine> =>
  Option.fromUndefinedOr(ts.getParsedCommandLineOfConfigFile(configPath, {}, configHost)).pipe(
    Option.filter((parsed) => Arr.isReadonlyArrayNonEmpty(parsed.fileNames)),
  );

const nearestPackageDirectory = (
  directory: string,
  root: string,
): Effect.Effect<string, never, RepositoryFiles> =>
  Effect.gen(function* nearestPackage() {
    const files = yield* RepositoryFiles;
    const hasManifest = yield* files.exists(files.join(directory, MANIFEST_FILE));
    const parent = files.dirname(directory);
    if (hasManifest || directory === root || parent === directory) {
      return directory;
    }
    return yield* nearestPackageDirectory(parent, root);
  });

const packageInfoOf = Effect.fn("packageInfoOf")(function* packageInfoOf(
  configPath: string,
  root: string,
) {
  const files = yield* RepositoryFiles;
  const directory = yield* nearestPackageDirectory(files.dirname(configPath), root);
  const manifest = yield* readManifest(directory);
  return {
    directory,
    name: manifest.pipe(Option.flatMap((found) => Option.fromUndefinedOr(found.name))),
    workspaceDependencies: manifest.pipe(
      Option.map(workspaceDependencies),
      Option.getOrElse(() => []),
    ),
  } satisfies PackageInfo;
});

const NO_CHECK_PRAGMA = /^\/\/\s*@ts-nocheck/u;
const FILE_START = 0;

const skipsTypeChecking = (sourceFile: ts.SourceFile): boolean =>
  pipe(
    ts.getLeadingCommentRanges(sourceFile.text, FILE_START) ?? [],
    Arr.some((range) => NO_CHECK_PRAGMA.test(Str.slice(range.pos, range.end)(sourceFile.text))),
  );

const DECLARATION_EXTENSION = ".d.ts";

const declarationFiles = new Map<string, ts.SourceFile>();

type ReadSourceFile = ts.CompilerHost["getSourceFile"];

const cachedDeclaration =
  (readSourceFile: ReadSourceFile): ReadSourceFile =>
  (fileName, languageVersion, onError) => {
    const key = `${fileName}\0${JSON.stringify(languageVersion)}`;
    const sourceFile =
      declarationFiles.get(key) ?? readSourceFile(fileName, languageVersion, onError);
    if (Predicate.isNotUndefined(sourceFile)) {
      declarationFiles.set(key, sourceFile);
    }
    return sourceFile;
  };

const sharingDeclarations = (parsed: ts.ParsedCommandLine): ts.CompilerHost => {
  const host = ts.createCompilerHost(parsed.options);
  const readSourceFile = host.getSourceFile.bind(host);
  const readDeclaration = cachedDeclaration(readSourceFile);
  return {
    ...host,
    getSourceFile: (fileName, languageVersion, onError) => {
      if (Str.endsWith(DECLARATION_EXTENSION)(fileName)) {
        return readDeclaration(fileName, languageVersion, onError);
      }
      return readSourceFile(fileName, languageVersion, onError);
    },
  };
};

const buildProject = Effect.fn("buildProject")(function* buildProject(
  parsed: ts.ParsedCommandLine,
  info: PackageInfo,
) {
  const entries = yield* dependencyEntries(info.directory);
  const program = ts.createProgram({
    rootNames: [
      ...parsed.fileNames,
      ...pipe(
        entries,
        Arr.map((entry) => entry.declarationsPath),
      ),
    ],
    options: { ...parsed.options, noEmit: true },
    host: sharingDeclarations(parsed),
  });
  program.getTypeChecker();
  const projectFiles = new Set(parsed.fileNames);
  return {
    packageName: info.name,
    workspaceDependencies: info.workspaceDependencies,
    program,
    sourceFiles: pipe(
      program.getSourceFiles(),
      Arr.filter(
        (sourceFile) =>
          projectFiles.has(sourceFile.fileName) &&
          !sourceFile.isDeclarationFile &&
          !skipsTypeChecking(sourceFile),
      ),
    ),
    library: libraryIndex(program)(entries),
  } satisfies Project;
});

const loadProject = Effect.fn("loadProject")(function* loadProject(
  configPath: string,
  root: string,
) {
  const parsed = parseConfig(configPath);
  if (Option.isNone(parsed)) {
    return Option.none<Project>();
  }
  const info = yield* packageInfoOf(configPath, root);
  return Option.some(yield* buildProject(parsed.value, info));
});

const loadProjects = Effect.fn("loadProjects")(function* loadProjects(
  root: string,
  configPaths: readonly string[],
) {
  const projects = yield* Fn.pipe(
    configPaths,
    Effect.forEach((configPath) => loadProject(configPath, root)),
  );
  return Arr.getSomes(projects);
});

export { listConfigFiles, loadProjects };
export type { Project };
