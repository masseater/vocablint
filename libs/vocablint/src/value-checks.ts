import { Array as Arr, Option, pipe } from "effect";
import ts from "typescript-6";

import type { Flow } from "./flows.ts";
import { describeLibraryType } from "./library.ts";
import type { LibraryVocabulary } from "./library.ts";
import { ownerKeyOf } from "./owners.ts";
import type { Owner } from "./owners.ts";
import { CANDIDATE_LIMIT, problemAt } from "./problem.ts";
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
const NOTHING_HIDDEN = 0;

const directOwners =
  (context: ValueContext) =>
  (symbol: ts.Symbol): readonly Owner[] => {
    const keys = Arr.getSomes(
      pipe(
        declarationsOf(symbol),
        Arr.map((declaration) => ownerKeyOf(declaration)),
      ),
    );
    return pipe(
      context.owners,
      Arr.filter((owner) => keys.includes(owner.key)),
    );
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
      pipe(
        declarationsOf(symbol),
        Arr.filter((declaration) => isFollowable(declaration)),
        Arr.flatMap((declaration) => referencedSymbols(context.checker)(declaration)),
        Arr.filter((referenced) => !visited.includes(referenced)),
        Arr.flatMap((referenced) => ownersBehind(context)(referenced, visited)),
      ),
    );
  };

const describeOwners = (owners: readonly Owner[]): string =>
  pipe(
    owners,
    Arr.map((owner) => `${owner.conceptId} (${owner.name})`),
    Arr.join(", "),
  );

const verdict = (problems: readonly Problem[], unowned: readonly ValueSite[]): SiteVerdict => ({
  problems,
  unowned,
});

const derivedVerdict =
  (context: ValueContext) =>
  (site: ValueSite): SiteVerdict => {
    const owners = uniqueByReference(
      pipe(
        site.sources,
        Arr.flatMap((source) => ownersBehind(context)(source, [])),
      ),
    );
    const held = pipe(
      owners,
      Arr.flatMap((owner) => owner.values),
    );
    const added = pipe(
      site.values,
      Arr.filter((value) => !isSubsetOf([value], held)),
    );
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
      pipe(
        context.flows,
        Arr.filter((flow) => flow.site.node === site.node),
        Arr.map((flow) => flow.target),
      ),
    );
    if (Arr.isReadonlyArrayNonEmpty(flowing)) {
      return flowing;
    }
    if (
      !pipe(
        site.values,
        Arr.some((value) => typeof value === "string"),
      )
    ) {
      return [];
    }
    return Arr.dedupe(
      pipe(
        context.vocabularies,
        Arr.filter((library) => isSubsetOf(site.values, library.vocabulary.values)),
        Arr.map((library) => describeLibraryType(library)),
      ),
    );
  };

const listCandidates = (candidates: readonly string[]): string => {
  const shown = pipe(Arr.take(candidates, CANDIDATE_LIMIT), Arr.join(", "));
  const hidden = candidates.length - CANDIDATE_LIMIT;
  if (hidden > NOTHING_HIDDEN) {
    return `${shown} and ${String(hidden)} more`;
  }
  return shown;
};

const originalVerdict =
  (context: ValueContext) =>
  (site: ValueSite): SiteVerdict => {
    const owners = pipe(
      context.owners,
      Arr.filter((owner) => isSubsetOf(site.values, owner.values)),
    );
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
  return (
    VALUE_PARENT_KINDS.has(parent.kind) ||
    pipe(
      VALUE_SLOTS,
      Arr.some((isSlot) => isSlot(node, parent)),
    )
  );
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
        pipe(
          contextSymbolsOf(context.checker)(literal),
          Arr.flatMap((symbol) => ownersBehind(context)(symbol, [])),
          uniqueByReference,
          Arr.filter((owner) => isSubsetOf([literal.text], pipe(owner.values, Arr.map(String)))),
        ),
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
      pipe(
        descendantsOf(sourceFile),
        Arr.filter((node) => ts.isStringLiteral(node) || ts.isNumericLiteral(node)),
        Arr.filter((node) => isValuePosition(node)),
        Arr.filter(
          (node) =>
            !pipe(
              excluded,
              Arr.some((outer) => contains(outer)(node)),
            ),
        ),
        Arr.map((node) => ownedLiteralProblem(context)(node)),
      ),
    );

export { ownedLiteralProblems, siteVerdict };
export type { SiteVerdict, ValueContext };
