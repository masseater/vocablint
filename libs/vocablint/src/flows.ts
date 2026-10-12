import { Array as Arr, Option } from "effect";
import ts from "typescript-6";

import type { ValueSite } from "./sites.ts";
import { annotationOf, slotOf } from "./slots.ts";
import {
  contains,
  declarationsOf,
  descendantsOf,
  isExternalDeclaration,
  NODE_MODULES_SEGMENT,
  symbolAt,
} from "./syntax.ts";
import { isSubsetOf, vocabularyOf } from "./values.ts";

interface Flow {
  readonly site: ValueSite;
  readonly target: string;
}

interface FlowContext {
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
  readonly sites: readonly ValueSite[];
}

const SCOPE_PREFIX = "@";
const SCOPED_SEGMENTS = 2;
const UNSCOPED_SEGMENTS = 1;
const MODULE_PREFIX = /^".*?"\./u;

const packageOf = (fileName: string): string => {
  const afterModules = fileName.slice(
    fileName.lastIndexOf(NODE_MODULES_SEGMENT) + NODE_MODULES_SEGMENT.length,
  );
  const segments = afterModules.split("/");
  if (afterModules.startsWith(SCOPE_PREFIX)) {
    return Arr.take(segments, SCOPED_SEGMENTS).join("/");
  }
  return Arr.take(segments, UNSCOPED_SEGMENTS).join("/");
};

const externalDeclarationOf =
  (context: FlowContext) =>
  (symbol: ts.Symbol): Option.Option<ts.Declaration> =>
    Arr.findFirst(declarationsOf(symbol), (declaration) =>
      isExternalDeclaration(context.program)(declaration),
    );

const aliasTarget =
  (context: FlowContext) =>
  (type: ts.Type): Option.Option<string> =>
    Option.fromUndefinedOr(type.aliasSymbol).pipe(
      Option.flatMap((alias) =>
        externalDeclarationOf(context)(alias).pipe(
          Option.map(
            (declaration) =>
              `${context.checker.getFullyQualifiedName(alias).replace(MODULE_PREFIX, "")} from ${packageOf(declaration.getSourceFile().fileName)}`,
          ),
        ),
      ),
    );

const isNamedContainer = (
  node: ts.Node,
): node is ts.SignatureDeclaration | ts.InterfaceDeclaration | ts.ClassDeclaration =>
  ts.isFunctionLike(node) || ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node);

const slotTarget =
  (context: FlowContext) =>
  (expression: ts.Expression): Option.Option<string> =>
    slotOf(context.checker)(expression).pipe(
      Option.filter((slot) => isExternalDeclaration(context.program)(slot)),
      Option.filter((slot) =>
        Option.isSome(vocabularyOf(context.checker)(context.checker.getTypeAtLocation(slot))),
      ),
      Option.map((slot) => {
        const owner = Option.liftPredicate(slot.parent, isNamedContainer).pipe(
          Option.flatMap((container) => Option.fromUndefinedOr(ts.getNameOfDeclaration(container))),
          Option.map((name) => ` of ${name.getText()}`),
          Option.getOrElse(() => ""),
        );
        const name = Option.fromUndefinedOr(ts.getNameOfDeclaration(slot)).pipe(
          Option.map((found) => found.getText()),
          Option.getOrElse(() => "value"),
        );
        return `${name}${owner} from ${packageOf(slot.getSourceFile().fileName)}`;
      }),
    );

const libraryTargetOf =
  (context: FlowContext) =>
  (expression: ts.Expression, contextual: ts.Type): Option.Option<string> =>
    aliasTarget(context)(contextual).pipe(Option.orElse(() => slotTarget(context)(expression)));

const siteWithin =
  (context: FlowContext) =>
  (node: ts.Node): Option.Option<ValueSite> =>
    Arr.findFirst(context.sites, (site) => contains(node)(site.node));

const aliasSite =
  (context: FlowContext) =>
  (type: ts.Type): Option.Option<ValueSite> =>
    Option.fromUndefinedOr(type.aliasSymbol).pipe(
      Option.flatMap((alias) => Arr.findFirst(declarationsOf(alias), ts.isTypeAliasDeclaration)),
      Option.flatMap(siteWithin(context)),
    );

const annotationSite =
  (context: FlowContext) =>
  (expression: ts.Expression): Option.Option<ValueSite> =>
    symbolAt(context.checker)(expression).pipe(
      Option.flatMap((symbol) => Option.fromUndefinedOr(symbol.valueDeclaration)),
      Option.flatMap(annotationOf),
      Option.flatMap((annotation) =>
        siteWithin(context)(annotation).pipe(
          Option.orElse(() => aliasSite(context)(context.checker.getTypeFromTypeNode(annotation))),
        ),
      ),
    );

const siteBehind =
  (context: FlowContext) =>
  (expression: ts.Expression): Option.Option<ValueSite> =>
    aliasSite(context)(context.checker.getTypeAtLocation(expression)).pipe(
      Option.orElse(() => annotationSite(context)(expression)),
    );

const isFlowSource = (node: ts.Node): node is ts.Expression =>
  ts.isIdentifier(node) ||
  ts.isPropertyAccessExpression(node) ||
  ts.isElementAccessExpression(node);

const flowOf =
  (context: FlowContext) =>
  (expression: ts.Expression): Option.Option<Flow> =>
    Option.fromUndefinedOr(context.checker.getContextualType(expression)).pipe(
      Option.flatMap((contextual) =>
        Option.all([
          vocabularyOf(context.checker)(contextual),
          libraryTargetOf(context)(expression, contextual),
        ]),
      ),
      Option.flatMap(([vocabulary, target]) =>
        siteBehind(context)(expression).pipe(
          Option.filter((site) => isSubsetOf(site.values, vocabulary.values)),
          Option.map((site) => ({ site, target })),
        ),
      ),
    );

const flowsIn =
  (context: FlowContext) =>
  (sourceFile: ts.SourceFile): readonly Flow[] =>
    Arr.getSomes(
      descendantsOf(sourceFile)
        .filter((node) => isFlowSource(node))
        .map((node) => flowOf(context)(node)),
    );

export { flowsIn };
export type { Flow, FlowContext };
