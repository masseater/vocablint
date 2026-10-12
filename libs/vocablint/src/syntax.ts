import { Array as Arr, Option } from "effect";
import ts from "typescript-6";

import { NODE_MODULES } from "./dependencies.ts";

const NODE_MODULES_SEGMENT = `/${NODE_MODULES}/`;

const POSITION_BASE = 1;

const uniqueByReference = <Item>(items: readonly Item[]): readonly Item[] =>
  Arr.dedupeWith(items, (left, right) => left === right);

const childrenOf = (node: ts.Node): readonly ts.Node[] => {
  const children: ts.Node[] = [];
  ts.forEachChild(node, (child) => {
    children.push(child);
  });
  return children;
};

const descendantsOf = (node: ts.Node): readonly ts.Node[] =>
  childrenOf(node).flatMap((child) => Arr.prepend(descendantsOf(child), child));

const isExternalFile =
  (program: ts.Program) =>
  (sourceFile: ts.SourceFile): boolean =>
    program.isSourceFileFromExternalLibrary(sourceFile) ||
    sourceFile.fileName.includes(NODE_MODULES_SEGMENT);

const isExternalDeclaration =
  (program: ts.Program) =>
  (declaration: ts.Node): boolean =>
    isExternalFile(program)(declaration.getSourceFile());

const ALIAS_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.ImportSpecifier,
  ts.SyntaxKind.ImportClause,
  ts.SyntaxKind.NamespaceImport,
  ts.SyntaxKind.ExportSpecifier,
  ts.SyntaxKind.ImportEqualsDeclaration,
  ts.SyntaxKind.ExportAssignment,
]);

const isAliasDeclaration = (declaration: ts.Node): boolean => ALIAS_KINDS.has(declaration.kind);

const resolvedSymbol =
  (checker: ts.TypeChecker) =>
  (symbol: ts.Symbol): ts.Symbol => {
    const declarations = symbol.getDeclarations() ?? [];
    if (!declarations.some((declaration) => isAliasDeclaration(declaration))) {
      return symbol;
    }
    return checker.getAliasedSymbol(symbol);
  };

const symbolAt =
  (checker: ts.TypeChecker) =>
  (node: ts.Node): Option.Option<ts.Symbol> =>
    Option.fromUndefinedOr(checker.getSymbolAtLocation(node)).pipe(
      Option.map(resolvedSymbol(checker)),
    );

const referencedSymbols =
  (checker: ts.TypeChecker) =>
  (node: ts.Node): readonly ts.Symbol[] => {
    const identifiers = Arr.prepend(descendantsOf(node), node).filter((candidate) =>
      ts.isIdentifier(candidate),
    );
    const symbols = identifiers.map((identifier) => symbolAt(checker)(identifier));
    return uniqueByReference(Arr.getSomes(symbols));
  };

const declarationsOf = (symbol: ts.Symbol): readonly ts.Declaration[] =>
  symbol.getDeclarations() ?? [];

const lineOf = (node: ts.Node): number => {
  const sourceFile = node.getSourceFile();
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + POSITION_BASE;
};

const columnOf = (node: ts.Node): number => {
  const sourceFile = node.getSourceFile();
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).character + POSITION_BASE
  );
};

const contains =
  (outer: ts.Node) =>
  (inner: ts.Node): boolean =>
    outer.getSourceFile() === inner.getSourceFile() &&
    outer.getStart() <= inner.getStart() &&
    inner.getEnd() <= outer.getEnd();

const isTypeDeclaration = (
  declaration: ts.Declaration,
): declaration is ts.TypeAliasDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration =>
  ts.isTypeAliasDeclaration(declaration) ||
  ts.isInterfaceDeclaration(declaration) ||
  ts.isEnumDeclaration(declaration);

const isGenericDeclaration = (declaration: ts.Declaration): boolean =>
  (ts.isTypeAliasDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)) &&
  Arr.isReadonlyArrayNonEmpty(declaration.typeParameters ?? []);

const propertyNamesOf =
  (checker: ts.TypeChecker) =>
  (type: ts.Type): readonly string[] =>
    checker.getPropertiesOfType(type).map((property) => property.getName());

export {
  NODE_MODULES_SEGMENT,
  POSITION_BASE,
  childrenOf,
  columnOf,
  contains,
  declarationsOf,
  descendantsOf,
  isExternalDeclaration,
  isGenericDeclaration,
  isTypeDeclaration,
  lineOf,
  propertyNamesOf,
  referencedSymbols,
  resolvedSymbol,
  symbolAt,
  uniqueByReference,
};
