import { Array as Arr, Option, Order, pipe } from "effect";
import ts from "typescript-6";

import { describeLibraryType, isObjectType } from "./library.ts";
import type { LibraryShape } from "./library.ts";
import { CANDIDATE_LIMIT, problemAt } from "./problem.ts";
import type { Problem } from "./problem.ts";
import {
  descendantsOf,
  isGenericDeclaration,
  propertyNamesOf,
  referencedSymbols,
} from "./syntax.ts";
import { schemaTypeOf } from "./values.ts";

interface ShapeContext {
  readonly checker: ts.TypeChecker;
  readonly shapes: readonly LibraryShape[];
}

interface ShapeSite {
  readonly node: ts.Node;
  readonly type: ts.Type;
}

interface ShapeMatch {
  readonly shape: LibraryShape;
  readonly extra: number;
}

const MINIMUM_SHAPE_PROPERTIES = 3;
const EXACT = 0;

const isPlainInterface = (node: ts.Node): node is ts.InterfaceDeclaration =>
  ts.isInterfaceDeclaration(node) && !isGenericDeclaration(node);

const isPlainTypeLiteral = (node: ts.Node): node is ts.TypeAliasDeclaration =>
  ts.isTypeAliasDeclaration(node) && !isGenericDeclaration(node) && ts.isTypeLiteralNode(node.type);

const isDeclaredShape = (
  node: ts.Node,
): node is ts.InterfaceDeclaration | ts.TypeAliasDeclaration =>
  isPlainInterface(node) || isPlainTypeLiteral(node);

const declaredShapeOf =
  (checker: ts.TypeChecker) =>
  (node: ts.Node): Option.Option<ts.Type> =>
    Option.liftPredicate(node, isDeclaredShape).pipe(
      Option.map((declaration) => checker.getTypeAtLocation(declaration.name)),
    );

const schemaShapeOf =
  (checker: ts.TypeChecker) =>
  (node: ts.Node): Option.Option<ts.Type> => {
    if (!ts.isCallExpression(node)) {
      return Option.none();
    }
    const { arguments: callArguments } = node;
    if (
      !pipe(
        callArguments,
        Arr.some((argument) => ts.isObjectLiteralExpression(argument)),
      )
    ) {
      return Option.none();
    }
    return schemaTypeOf(checker)(checker.getTypeAtLocation(node)).pipe(
      Option.filter((type) => isObjectType(checker)(type)),
    );
  };

const shapeSitesIn =
  (checker: ts.TypeChecker) =>
  (sourceFile: ts.SourceFile): readonly ShapeSite[] =>
    Arr.getSomes(
      pipe(
        descendantsOf(sourceFile),
        Arr.map((node) =>
          declaredShapeOf(checker)(node).pipe(
            Option.orElse(() => schemaShapeOf(checker)(node)),
            Option.map((type) => ({ node, type })),
          ),
        ),
      ),
    );

const sameProperty =
  (checker: ts.TypeChecker) =>
  (local: ts.Symbol, library: ts.Symbol): boolean => {
    const localType = checker.getTypeOfSymbol(local);
    const libraryType = checker.getTypeOfSymbol(library);
    return (
      libraryType !== checker.getAnyType() &&
      libraryType !== checker.getUnknownType() &&
      checker.isTypeAssignableTo(localType, libraryType) &&
      checker.isTypeAssignableTo(libraryType, localType)
    );
  };

const matchOf =
  (context: ShapeContext) =>
  (site: ShapeSite, shape: LibraryShape): Option.Option<ShapeMatch> => {
    const { checker } = context;
    const locals = checker.getPropertiesOfType(site.type);
    const matches = pipe(
      locals,
      Arr.every((local) =>
        Option.fromUndefinedOr(checker.getPropertyOfType(shape.type, local.getName())).pipe(
          Option.exists((library) => sameProperty(checker)(local, library)),
        ),
      ),
    );
    if (!matches) {
      return Option.none();
    }
    return Option.some({
      shape,
      extra: propertyNamesOf(checker)(shape.type).length - locals.length,
    });
  };

const isDerivedFrom =
  (context: ShapeContext) =>
  (site: ShapeSite, shape: LibraryShape): boolean =>
    pipe(
      referencedSymbols(context.checker)(site.node),
      Arr.some((symbol) => (symbol.getDeclarations() ?? []).includes(shape.declaration)),
    );

const matchOrder = Order.mapInput(Order.Number, (match: ShapeMatch) => match.extra);

const shapeProblem = (site: ShapeSite, matches: readonly ShapeMatch[]): Problem => {
  const shown = pipe(
    Arr.take(matches, CANDIDATE_LIMIT),
    Arr.map((match) => describeLibraryType(match.shape)),
    Arr.join(", "),
  );
  const advice = Option.match(
    Arr.findFirst(matches, (match) => match.extra === EXACT),
    {
      onNone: () =>
        "Derive it from the library type, for example with Pick, instead of copying its properties.",
      onSome: () => "Use the library type instead of copying it.",
    },
  );
  return problemAt({ rule: "library-shape", message: `This shape copies ${shown}. ${advice}` })(
    site.node,
  );
};

const shapeProblemOf =
  (context: ShapeContext) =>
  (site: ShapeSite): Option.Option<Problem> => {
    const names = propertyNamesOf(context.checker)(site.type);
    if (names.length < MINIMUM_SHAPE_PROPERTIES) {
      return Option.none();
    }
    const candidates = pipe(
      context.shapes,
      Arr.filter((shape) => !isDerivedFrom(context)(site, shape)),
      Arr.map((shape) => matchOf(context)(site, shape)),
      Arr.getSomes,
    );
    const matches = Arr.sort(candidates, matchOrder);
    return Option.liftPredicate(matches, Arr.isReadonlyArrayNonEmpty).pipe(
      Option.map((found) => shapeProblem(site, found)),
    );
  };

const shapeProblemsIn =
  (context: ShapeContext) =>
  (sourceFile: ts.SourceFile): readonly Problem[] =>
    Arr.getSomes(
      pipe(
        shapeSitesIn(context.checker)(sourceFile),
        Arr.map((site) => shapeProblemOf(context)(site)),
      ),
    );

export { shapeProblemsIn };
export type { ShapeContext };
