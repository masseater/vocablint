import { Array as Arr, Option } from "effect";
import ts from "typescript-6";

import { childrenOf, declarationsOf, referencedSymbols } from "./syntax.ts";
import { finiteValuesOf, isSubsetOf, literalUnionOf, schemaTypeOf } from "./values.ts";
import type { Value } from "./values.ts";

interface ValueSite {
  readonly node: ts.Node;
  readonly values: readonly Value[];
  readonly sources: readonly ts.Symbol[];
}

const isTypeDeclaration = (declaration: ts.Declaration): boolean =>
  ts.isTypeAliasDeclaration(declaration) ||
  ts.isInterfaceDeclaration(declaration) ||
  ts.isEnumDeclaration(declaration);

const namedValuesOf =
  (checker: ts.TypeChecker) =>
  (symbol: ts.Symbol): Option.Option<readonly Value[]> => {
    if (declarationsOf(symbol).some((declaration) => isTypeDeclaration(declaration))) {
      return finiteValuesOf(checker)(checker.getDeclaredTypeOfSymbol(symbol));
    }
    return finiteValuesOf(checker)(checker.getTypeOfSymbol(symbol));
  };

const hasFiniteContext =
  (checker: ts.TypeChecker) =>
  (node: ts.Expression): boolean =>
    Option.fromUndefinedOr(checker.getContextualType(node)).pipe(
      Option.flatMap(finiteValuesOf(checker)),
      Option.isSome,
    );

const expressionValuesOf =
  (checker: ts.TypeChecker) =>
  (node: ts.Expression): Option.Option<readonly Value[]> => {
    if (hasFiniteContext(checker)(node)) {
      return Option.none();
    }
    const type = checker.getTypeAtLocation(node);
    if (ts.isArrayLiteralExpression(node)) {
      return finiteValuesOf(checker)(type);
    }
    return schemaTypeOf(checker)(type).pipe(Option.flatMap(literalUnionOf));
  };

const propertyNamesOf =
  (checker: ts.TypeChecker) =>
  (node: ts.TypeNode): readonly Value[] =>
    checker
      .getPropertiesOfType(checker.getTypeFromTypeNode(node))
      .map((property) => property.getName());

const selectsKeys =
  (checker: ts.TypeChecker) =>
  (node: ts.UnionTypeNode, values: readonly Value[]): boolean => {
    const { parent } = node;
    if (!ts.isTypeReferenceNode(parent)) {
      return false;
    }
    return (parent.typeArguments ?? [])
      .filter((argument) => argument !== node)
      .some((argument) => isSubsetOf(values, propertyNamesOf(checker)(argument)));
  };

const unionValuesOf =
  (checker: ts.TypeChecker) =>
  (node: ts.UnionTypeNode): Option.Option<readonly Value[]> =>
    literalUnionOf(checker.getTypeFromTypeNode(node)).pipe(
      Option.filter((values) => !selectsKeys(checker)(node, values)),
    );

const isExpressionSite = (node: ts.Node): node is ts.ArrayLiteralExpression | ts.CallExpression =>
  ts.isArrayLiteralExpression(node) || ts.isCallExpression(node);

const expressionSiteValuesOf =
  (checker: ts.TypeChecker) =>
  (node: ts.Node): Option.Option<readonly Value[]> =>
    Option.liftPredicate(node, isExpressionSite).pipe(Option.flatMap(expressionValuesOf(checker)));

const siteValuesOf =
  (checker: ts.TypeChecker) =>
  (node: ts.Node): Option.Option<readonly Value[]> => {
    if (ts.isUnionTypeNode(node)) {
      return unionValuesOf(checker)(node);
    }
    if (ts.isEnumDeclaration(node)) {
      return literalUnionOf(checker.getTypeAtLocation(node.name));
    }
    return expressionSiteValuesOf(checker)(node);
  };

const derivationScopeOf = (node: ts.Node): ts.Node => {
  if (ts.isTypeReferenceNode(node.parent)) {
    return node.parent;
  }
  return node;
};

const sourcesOf =
  (checker: ts.TypeChecker) =>
  (node: ts.Node): readonly ts.Symbol[] =>
    referencedSymbols(checker)(derivationScopeOf(node)).filter((symbol) =>
      Option.isSome(namedValuesOf(checker)(symbol)),
    );

const sitesUnder =
  (checker: ts.TypeChecker) =>
  (node: ts.Node): readonly ValueSite[] => {
    const nested = childrenOf(node).flatMap((child) => sitesUnder(checker)(child));
    if (Arr.isReadonlyArrayNonEmpty(nested)) {
      return nested;
    }
    return siteValuesOf(checker)(node).pipe(
      Option.map((values) => ({ node, values, sources: sourcesOf(checker)(node) })),
      Option.toArray,
    );
  };

export { sitesUnder };
export type { ValueSite };
