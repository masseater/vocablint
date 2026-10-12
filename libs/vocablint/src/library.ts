import { Array as Arr, Option } from "effect";
import ts from "typescript-6";

import type { DependencyEntry } from "./dependencies.ts";
import {
  declarationsOf,
  isGenericDeclaration,
  isTypeDeclaration,
  resolvedSymbol,
} from "./syntax.ts";
import { schemaTypeOf, vocabularyOf } from "./values.ts";
import type { Vocabulary } from "./values.ts";

interface LibraryType {
  readonly specifier: string;
  readonly typeName: string;
  readonly declaration: ts.Declaration;
}

interface LibraryVocabulary extends LibraryType {
  readonly vocabulary: Vocabulary;
}

interface LibraryShape extends LibraryType {
  readonly type: ts.Type;
}

interface LibraryIndex {
  readonly vocabularies: readonly LibraryVocabulary[];
  readonly shapes: readonly LibraryShape[];
}

interface Walk {
  readonly checker: ts.TypeChecker;
  readonly entry: DependencyEntry;
}

interface Visit {
  readonly exported: ts.Symbol;
  readonly qualifier: string;
  readonly ancestors: readonly ts.Symbol[];
}

interface Exported {
  readonly symbol: ts.Symbol;
  readonly typeName: string;
}

const NAMESPACE_DEPTH_LIMIT = 8;
const EMPTY_INDEX: LibraryIndex = { vocabularies: [], shapes: [] };

const isObjectType =
  (checker: ts.TypeChecker) =>
  (type: ts.Type): boolean =>
    !type.isUnion() &&
    !type.isLiteral() &&
    checker.getApparentType(type) === type &&
    Arr.isReadonlyArrayNonEmpty(checker.getPropertiesOfType(type));

const describeLibraryType = (type: LibraryType): string =>
  `${type.typeName} from ${type.specifier}`;

const libraryType = (walk: Walk, typeName: string, declaration: ts.Declaration): LibraryType => ({
  specifier: walk.entry.specifier,
  typeName,
  declaration,
});

const declaredTypeIndex = (walk: Walk, exported: Exported): LibraryIndex => {
  const declaration = Arr.findFirst(declarationsOf(exported.symbol), isTypeDeclaration);
  if (Option.isNone(declaration) || isGenericDeclaration(declaration.value)) {
    return EMPTY_INDEX;
  }
  const located = libraryType(walk, exported.typeName, declaration.value);
  const type = walk.checker.getDeclaredTypeOfSymbol(exported.symbol);
  const vocabularies = vocabularyOf(walk.checker)(type).pipe(
    Option.map((vocabulary) => ({ ...located, vocabulary })),
    Option.toArray,
  );
  const shapes = Arr.filter([{ ...located, type }], () => isObjectType(walk.checker)(type));
  return { vocabularies, shapes };
};

const schemaTypeIndex = (walk: Walk, located: LibraryType, schemaType: ts.Type): LibraryIndex => ({
  vocabularies: vocabularyOf(walk.checker)(schemaType).pipe(
    Option.map((vocabulary) => ({ ...located, vocabulary })),
    Option.toArray,
  ),
  shapes: Arr.filter([{ ...located, type: schemaType }], () =>
    isObjectType(walk.checker)(schemaType),
  ),
});

const schemaValueIndex = (walk: Walk, exported: Exported): LibraryIndex => {
  const declaration = Arr.findFirst(declarationsOf(exported.symbol), ts.isVariableDeclaration);
  if (Option.isNone(declaration)) {
    return EMPTY_INDEX;
  }
  const valueType = walk.checker.getTypeOfSymbolAtLocation(exported.symbol, declaration.value);
  const located = libraryType(walk, `(typeof ${exported.typeName})["Type"]`, declaration.value);
  return Option.match(schemaTypeOf(walk.checker)(valueType), {
    onNone: () => EMPTY_INDEX,
    onSome: (schemaType) => schemaTypeIndex(walk, located, schemaType),
  });
};

const mergeIndexes = (indexes: readonly LibraryIndex[]): LibraryIndex => ({
  vocabularies: indexes.flatMap((index) => index.vocabularies),
  shapes: indexes.flatMap((index) => index.shapes),
});

const isNamespace = (symbol: ts.Symbol): boolean =>
  declarationsOf(symbol).some((declaration) => ts.isModuleDeclaration(declaration));

const indexUnder = (walk: Walk, visit: Visit): LibraryIndex => {
  const symbol = resolvedSymbol(walk.checker)(visit.exported);
  const named = { symbol, typeName: `${visit.qualifier}${visit.exported.getName()}` };
  const own = mergeIndexes([declaredTypeIndex(walk, named), schemaValueIndex(walk, named)]);
  if (
    !isNamespace(symbol) ||
    visit.ancestors.length >= NAMESPACE_DEPTH_LIMIT ||
    visit.ancestors.includes(symbol)
  ) {
    return own;
  }
  const nested = walk.checker.getExportsOfModule(symbol).map((member) =>
    indexUnder(walk, {
      exported: member,
      qualifier: `${named.typeName}.`,
      ancestors: [...visit.ancestors, symbol],
    }),
  );
  return mergeIndexes([own, ...nested]);
};

const exportAssignmentOf = (moduleSymbol: ts.Symbol): Option.Option<ts.Symbol> =>
  Option.fromUndefinedOr(moduleSymbol.exports).pipe(
    Option.flatMap((exports) =>
      Option.fromUndefinedOr(exports.get(ts.InternalSymbolName.ExportEquals)),
    ),
  );

const indexOfEntry =
  (program: ts.Program) =>
  (entry: DependencyEntry): LibraryIndex => {
    const checker = program.getTypeChecker();
    const moduleSymbol = Option.fromUndefinedOr(program.getSourceFile(entry.declarationsPath)).pipe(
      Option.flatMap((sourceFile) =>
        Option.fromUndefinedOr(checker.getSymbolAtLocation(sourceFile)),
      ),
    );
    if (Option.isNone(moduleSymbol)) {
      return EMPTY_INDEX;
    }
    const walk: Walk = { checker, entry };
    const roots = Option.match(exportAssignmentOf(moduleSymbol.value), {
      onNone: () => checker.getExportsOfModule(moduleSymbol.value),
      onSome: (assigned) => [resolvedSymbol(checker)(assigned)],
    });
    return mergeIndexes(
      roots.map((exported) => indexUnder(walk, { exported, qualifier: "", ancestors: [] })),
    );
  };

const libraryIndex =
  (program: ts.Program) =>
  (entries: readonly DependencyEntry[]): LibraryIndex =>
    mergeIndexes(entries.map((entry) => indexOfEntry(program)(entry)));

export { describeLibraryType, isObjectType, libraryIndex };
export type { LibraryIndex, LibraryShape, LibraryType, LibraryVocabulary };
