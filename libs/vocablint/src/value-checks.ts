import { Array as Arr, Option } from "effect";
import ts from "typescript-6";

import type { Flow } from "./flows.ts";
import type { LibraryVocabulary } from "./library.ts";
import { ownerKeyOf } from "./owners.ts";
import type { Owner } from "./owners.ts";
import { problemAt } from "./problem.ts";
import type { Problem } from "./problem.ts";
import type { ValueSite } from "./sites.ts";
import { contextSymbolsOf } from "./slots.ts";
import {
  contains,
  declarationsOf,
  descendantsOf,
  referencedSymbols,
  uniqueByReference,
} from "./syntax.ts";
import { formatValues, isSubsetOf, vocabularyOf } from "./values.ts";

interface ValueContext {
  readonly checker: ts.TypeChecker;
  readonly owners: readonly Owner[];
  readonly vocabularies: readonly LibraryVocabulary[];
  readonly flows: readonly Flow[];
}

interface SiteVerdict {
  readonly problems: readonly Problem[];
  readonly unowned: readonly ValueSite[];
}

const OWNER_SEARCH_DEPTH = 4;
const CANDIDATE_LIMIT = 3;
const NOTHING_HIDDEN = 0;

const directOwners =
  (context: ValueContext) =>
  (symbol: ts.Symbol): readonly Owner[] => {
    const keys = Arr.getSomes(declarationsOf(symbol).map((declaration) => ownerKeyOf(declaration)));
    return context.owners.filter((owner) => keys.includes(owner.key));
  };

const isFollowable = (declaration: ts.Declaration): boolean =>
  !declaration.getSourceFile().isDeclarationFile &&
  (ts.isTypeAliasDeclaration(declaration) || ts.isVariableDeclaration(declaration));

const ownersBehind =
  (context: ValueContext) =>
  (symbol: ts.Symbol, ancestors: readonly ts.Symbol[]): readonly Owner[] => {
    const direct = directOwners(context)(symbol);
    if (Arr.isReadonlyArrayNonEmpty(direct) || ancestors.length >= OWNER_SEARCH_DEPTH) {
      return direct;
    }
    const visited = [...ancestors, symbol];
    return uniqueByReference(
      declarationsOf(symbol)
        .filter((declaration) => isFollowable(declaration))
        .flatMap((declaration) => referencedSymbols(context.checker)(declaration))
        .filter((referenced) => !visited.includes(referenced))
        .flatMap((referenced) => ownersBehind(context)(referenced, visited)),
    );
  };

const describeOwners = (owners: readonly Owner[]): string =>
  owners.map((owner) => `${owner.conceptId} (${owner.name})`).join(", ");

const verdict = (problems: readonly Problem[], unowned: readonly ValueSite[]): SiteVerdict => ({
  problems,
  unowned,
});

const derivedVerdict =
  (context: ValueContext) =>
  (site: ValueSite): SiteVerdict => {
    const owners = uniqueByReference(
      site.sources.flatMap((source) => ownersBehind(context)(source, [])),
    );
    const held = owners.flatMap((owner) => owner.values);
    const added = site.values.filter((value) => !isSubsetOf([value], held));
    if (!Arr.isReadonlyArrayNonEmpty(owners) || !Arr.isReadonlyArrayNonEmpty(added)) {
      return verdict([], []);
    }
    const message = `This set adds ${formatValues(added)} to ${describeOwners(owners)}. Add the values to the owner, or register the wider set as its own concept.`;
    return verdict([problemAt({ rule: "owner-extension", message })(site.node)], []);
  };

const libraryCandidates =
  (context: ValueContext) =>
  (site: ValueSite): readonly string[] => {
    const flowing = Arr.dedupe(
      context.flows.filter((flow) => flow.site.node === site.node).map((flow) => flow.target),
    );
    if (Arr.isReadonlyArrayNonEmpty(flowing)) {
      return flowing;
    }
    if (!site.values.some((value) => typeof value === "string")) {
      return [];
    }
    return Arr.dedupe(
      context.vocabularies
        .filter((library) => isSubsetOf(site.values, library.vocabulary.values))
        .map((library) => `${library.typeName} from ${library.specifier}`),
    );
  };

const listCandidates = (candidates: readonly string[]): string => {
  const shown = Arr.take(candidates, CANDIDATE_LIMIT).join(", ");
  const hidden = candidates.length - CANDIDATE_LIMIT;
  if (hidden > NOTHING_HIDDEN) {
    return `${shown} and ${String(hidden)} more`;
  }
  return shown;
};

const originalVerdict =
  (context: ValueContext) =>
  (site: ValueSite): SiteVerdict => {
    const owners = context.owners.filter((owner) => isSubsetOf(site.values, owner.values));
    if (Arr.isReadonlyArrayNonEmpty(owners)) {
      const message = `The values ${formatValues(site.values)} are owned by ${describeOwners(owners)}. Derive this set from the owner instead of restating it.`;
      return verdict([problemAt({ rule: "owner-value-set", message })(site.node)], []);
    }
    const candidates = libraryCandidates(context)(site);
    if (Arr.isReadonlyArrayNonEmpty(candidates)) {
      const message = `The values ${formatValues(site.values)} restate a dependency type: ${listCandidates(candidates)}. Derive this set from the library type.`;
      return verdict([problemAt({ rule: "library-value-set", message })(site.node)], []);
    }
    return verdict([], [site]);
  };

const siteVerdict =
  (context: ValueContext) =>
  (site: ValueSite): SiteVerdict => {
    if (Arr.isReadonlyArrayNonEmpty(site.sources)) {
      return derivedVerdict(context)(site);
    }
    return originalVerdict(context)(site);
  };

const VALUE_PARENT_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.ReturnStatement,
  ts.SyntaxKind.ArrayLiteralExpression,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.ParenthesizedExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.JsxExpression,
]);

const isCallArgument = (node: ts.Node, parent: ts.Node): boolean =>
  (ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.expression !== node;

const isInitializer = (node: ts.Node, parent: ts.Node): boolean =>
  (ts.isPropertyAssignment(parent) || ts.isVariableDeclaration(parent)) &&
  parent.initializer === node;

const isRightOperand = (node: ts.Node, parent: ts.Node): boolean =>
  ts.isBinaryExpression(parent) && parent.right === node;

const VALUE_SLOTS = [isCallArgument, isInitializer, isRightOperand];

const isValuePosition = (node: ts.Node): boolean => {
  const { parent } = node;
  return VALUE_PARENT_KINDS.has(parent.kind) || VALUE_SLOTS.some((isSlot) => isSlot(node, parent));
};

const ownedLiteralProblem =
  (context: ValueContext) =>
  (literal: ts.StringLiteral | ts.NumericLiteral): Option.Option<Problem> =>
    Option.fromUndefinedOr(context.checker.getContextualType(literal)).pipe(
      Option.filter((contextual) =>
        vocabularyOf(context.checker)(contextual).pipe(
          Option.exists((vocabulary) => !vocabulary.admitsUnnamedValues),
        ),
      ),
      Option.map(() =>
        uniqueByReference(
          contextSymbolsOf(context.checker)(literal).flatMap((symbol) =>
            ownersBehind(context)(symbol, []),
          ),
        ).filter((owner) => isSubsetOf([literal.text], owner.values.map(String))),
      ),
      Option.filter((owners) => Arr.isReadonlyArrayNonEmpty(owners)),
      Option.map((owners) =>
        problemAt({
          rule: "owned-literal",
          message: `${literal.getText()} is a value of ${describeOwners(owners)}. Write it through the owner's binding instead of as a literal.`,
        })(literal),
      ),
    );

const ownedLiteralProblems =
  (context: ValueContext) =>
  (sourceFile: ts.SourceFile, excluded: readonly ts.Node[]): readonly Problem[] =>
    Arr.getSomes(
      descendantsOf(sourceFile)
        .filter((node) => ts.isStringLiteral(node) || ts.isNumericLiteral(node))
        .filter((node) => isValuePosition(node))
        .filter((node) => !excluded.some((outer) => contains(outer)(node)))
        .map((node) => ownedLiteralProblem(context)(node)),
    );

export { ownedLiteralProblems, siteVerdict };
export type { SiteVerdict, ValueContext };
