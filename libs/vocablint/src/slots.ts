import { Array as Arr, Option } from "effect";
import ts from "typescript-6";

import { declarationsOf, referencedSymbols } from "./syntax.ts";

type AnnotatedDeclaration =
  | ts.ParameterDeclaration
  | ts.VariableDeclaration
  | ts.PropertySignature
  | ts.PropertyDeclaration;

const ANNOTATED_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.Parameter,
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.PropertyDeclaration,
]);

const isAnnotated = (declaration: ts.Declaration): declaration is AnnotatedDeclaration =>
  ANNOTATED_KINDS.has(declaration.kind);

const annotationOf = (declaration: ts.Declaration): Option.Option<ts.TypeNode> =>
  Option.liftPredicate(declaration, isAnnotated).pipe(
    Option.flatMap((annotated) => Option.fromUndefinedOr(annotated.type)),
  );

const argumentSlot =
  (checker: ts.TypeChecker) =>
  (expression: ts.Expression): Option.Option<ts.Declaration> => {
    const call = expression.parent;
    if (!ts.isCallExpression(call) && !ts.isNewExpression(call)) {
      return Option.none();
    }
    const { arguments: listed } = call;
    const callArguments: readonly ts.Expression[] = listed ?? [];
    const index = callArguments.indexOf(expression);
    return Option.fromUndefinedOr(checker.getResolvedSignature(call)).pipe(
      Option.flatMap((signature) => Option.fromUndefinedOr(signature.getDeclaration())),
      Option.flatMap((declaration) => Arr.get(declaration.parameters, index)),
    );
  };

const propertySlot =
  (checker: ts.TypeChecker) =>
  (expression: ts.Expression): Option.Option<ts.Declaration> => {
    const assignment = expression.parent;
    if (!ts.isPropertyAssignment(assignment) || !ts.isObjectLiteralExpression(assignment.parent)) {
      return Option.none();
    }
    return Option.fromUndefinedOr(checker.getContextualType(assignment.parent)).pipe(
      Option.flatMap((objectType) =>
        Option.fromUndefinedOr(objectType.getProperty(assignment.name.getText())),
      ),
      Option.flatMap((property) => Arr.head(declarationsOf(property))),
    );
  };

const variableSlot = (expression: ts.Expression): Option.Option<ts.Declaration> => {
  const declaration = expression.parent;
  if (!ts.isVariableDeclaration(declaration) || declaration.initializer !== expression) {
    return Option.none();
  }
  return Option.some(declaration);
};

const slotOf =
  (checker: ts.TypeChecker) =>
  (expression: ts.Expression): Option.Option<ts.Declaration> =>
    argumentSlot(checker)(expression).pipe(
      Option.orElse(() => propertySlot(checker)(expression)),
      Option.orElse(() => variableSlot(expression)),
    );

const contextSymbolsOf =
  (checker: ts.TypeChecker) =>
  (expression: ts.Expression): readonly ts.Symbol[] => {
    const alias = Option.fromUndefinedOr(checker.getContextualType(expression)).pipe(
      Option.flatMap((contextual) => Option.fromUndefinedOr(contextual.aliasSymbol)),
    );
    if (Option.isSome(alias)) {
      return [alias.value];
    }
    return slotOf(checker)(expression).pipe(
      Option.flatMap(annotationOf),
      Option.map((annotation) => referencedSymbols(checker)(annotation)),
      Option.getOrElse(() => []),
    );
  };

export { annotationOf, contextSymbolsOf, slotOf };
