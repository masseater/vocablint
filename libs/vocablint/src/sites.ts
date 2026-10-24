import { Array as Arr, Option, pipe } from "effect";
import ts from "typescript-6";

import {
  childrenOf,
  declarationsOf,
  isTypeDeclaration,
  propertyNamesOf,
  referencedSymbols,
} from "./syntax.ts";
import { finiteValuesOf, isSubsetOf, literalUnionOf, schemaTypeOf } from "./values.ts";
import type { Value } from "./values.ts";

interface ValueSite {
  readonly node: ts.Node;
  readonly values: readonly Value[];
  readonly sources: readonly ts.Symbol[];
}

const namedValuesOf =
  (checker: ts.TypeChecker) =>
  (symbol: ts.Symbol): Option.Option<readonly Value[]> => {
    if (
      pipe(
        declarationsOf(symbol),
        Arr.some((declaration) => isTypeDeclaration(declaration)),
      )
    ) {
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

const selectsKeys =
  (checker: ts.TypeChecker) =>
  (node: ts.UnionTypeNode, values: readonly Value[]): boolean => {
    const { parent } = node;
    if (!ts.isTypeReferenceNode(parent)) {
      return false;
    }
    const typeArguments: readonly ts.TypeNode[] = parent.typeArguments ?? [];
    return pipe(
      typeArguments,
      Arr.filter((argument) => argument !== node),
      Arr.some((argument) =>
        isSubsetOf(values, propertyNamesOf(checker)(checker.getTypeFromTypeNode(argument))),
      ),
    );
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
    pipe(
      referencedSymbols(checker)(derivationScopeOf(node)),
      Arr.filter((symbol) => Option.isSome(namedValuesOf(checker)(symbol))),
    );

const sitesUnder =
  (checker: ts.TypeChecker) =>
  (node: ts.Node): readonly ValueSite[] => {
    const nested = pipe(
      childrenOf(node),
      Arr.flatMap((child) => sitesUnder(checker)(child)),
    );
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
