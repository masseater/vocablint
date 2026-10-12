import { Array as Arr, Option } from "effect";
import ts from "typescript-6";

import { problemAt, problemKey } from "./problem.ts";
import type { Problem } from "./problem.ts";
import type { Project } from "./project.ts";
import { descendantsOf } from "./syntax.ts";
import { finiteValuesOf, formatValues, literalValuesOf, sameValues } from "./values.ts";
import type { Value } from "./values.ts";

interface Owner {
  readonly conceptId: string;
  readonly key: string;
  readonly name: string;
  readonly declaration: ts.VariableDeclaration;
  readonly packageName: Option.Option<string>;
  readonly values: readonly Value[];
}

interface OwnerScan {
  readonly owners: readonly Owner[];
  readonly problems: readonly Problem[];
}

interface Annotated {
  readonly node: ts.Node;
  readonly conceptId: string;
}

const OWNER_TAG = "vocablint";
const FIRST_OWNER_COUNT = 1;

const ownerKeyOf = (declaration: ts.Declaration): Option.Option<string> => {
  if (!ts.isVariableDeclaration(declaration) || !ts.isIdentifier(declaration.name)) {
    return Option.none();
  }
  return Option.some(`${declaration.getSourceFile().fileName}#${declaration.name.text}`);
};

const annotationsOf = (node: ts.Node): readonly Annotated[] =>
  ts
    .getJSDocTags(node)
    .filter((tag) => tag.tagName.text === OWNER_TAG)
    .map((tag) => ({ node, conceptId: (ts.getTextOfJSDocComment(tag.comment) ?? "").trim() }));

const ANNOTATABLE_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.PropertyAssignment,
  ts.SyntaxKind.PropertyDeclaration,
]);

const isAnnotatable = (node: ts.Node): boolean => ANNOTATABLE_KINDS.has(node.kind);

const isConstList = (list: ts.VariableDeclarationList): boolean =>
  Option.fromUndefinedOr(list.getFirstToken()).pipe(
    Option.exists((token) => token.kind === ts.SyntaxKind.ConstKeyword),
  );

const isModuleStatementList = (list: ts.VariableDeclarationList): boolean =>
  ts.isVariableStatement(list.parent) && ts.isSourceFile(list.parent.parent);

const isModuleConstList = (node: ts.Node): node is ts.VariableDeclarationList =>
  ts.isVariableDeclarationList(node) && isModuleStatementList(node) && isConstList(node);

const isModuleConst = (node: ts.Node): node is ts.VariableDeclaration =>
  ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isModuleConstList(node.parent);

const objectValuesOf =
  (checker: ts.TypeChecker) =>
  (type: ts.Type): Option.Option<readonly Value[]> =>
    literalValuesOf(
      checker.getPropertiesOfType(type).map((property) => checker.getTypeOfSymbol(property)),
    );

const ownerValuesOf =
  (checker: ts.TypeChecker) =>
  (declaration: ts.VariableDeclaration): Option.Option<readonly Value[]> => {
    const type = checker.getTypeAtLocation(declaration.name);
    return finiteValuesOf(checker)(type).pipe(Option.orElse(() => objectValuesOf(checker)(type)));
  };

const annotationProblem = (message: string): ((node: ts.Node) => Problem) =>
  problemAt({ rule: "owner-annotation", message });

const scanned = (owners: readonly Owner[], problems: readonly Problem[]): OwnerScan => ({
  owners,
  problems,
});

const ownerOf =
  (project: Project) =>
  (annotated: Annotated): OwnerScan => {
    const { node, conceptId } = annotated;
    if (!isModuleConst(node)) {
      return scanned(
        [],
        [annotationProblem("@vocablint registers an owner only on a module-scope const.")(node)],
      );
    }
    if (conceptId === "") {
      return scanned([], [annotationProblem("@vocablint needs a concept id.")(node)]);
    }
    const values = ownerValuesOf(project.program.getTypeChecker())(node);
    return Option.match(Option.all([values, ownerKeyOf(node)]), {
      onNone: () =>
        scanned(
          [],
          [annotationProblem(`The owner of ${conceptId} holds no finite value set.`)(node)],
        ),
      onSome: ([ownedValues, key]) =>
        scanned(
          [
            {
              conceptId,
              key,
              name: node.name.getText(),
              declaration: node,
              packageName: project.packageName,
              values: ownedValues,
            },
          ],
          [],
        ),
    });
  };

const annotatedIn = (sourceFile: ts.SourceFile): readonly Annotated[] =>
  descendantsOf(sourceFile)
    .filter((node) => isAnnotatable(node))
    .flatMap((node) => annotationsOf(node));

const conflictProblems = (owners: readonly Owner[]): readonly Problem[] =>
  owners.flatMap((owner, index) => {
    const earlier = Arr.take(owners, index);
    const sameConcept = earlier.filter((other) => other.conceptId === owner.conceptId);
    const sameSet = earlier.filter(
      (other) => other.conceptId !== owner.conceptId && sameValues(other.values, owner.values),
    );
    return [
      ...Arr.take(sameConcept, FIRST_OWNER_COUNT).map(() =>
        annotationProblem(`The concept ${owner.conceptId} already has an owner.`)(
          owner.declaration,
        ),
      ),
      ...Arr.take(sameSet, FIRST_OWNER_COUNT).map((other) =>
        annotationProblem(
          `The values ${formatValues(owner.values)} are already owned by ${other.conceptId}.`,
        )(owner.declaration),
      ),
    ];
  });

const scanOwners = (projects: readonly Project[]): OwnerScan => {
  const results = projects.flatMap((project) =>
    project.sourceFiles.flatMap((sourceFile) =>
      annotatedIn(sourceFile).map((annotated) => ownerOf(project)(annotated)),
    ),
  );
  const owners = Arr.dedupeWith(
    results.flatMap((result) => result.owners),
    (left, right) => left.key === right.key,
  );
  const problems = Arr.dedupeWith(
    [...results.flatMap((result) => result.problems), ...conflictProblems(owners)],
    (left, right) => problemKey(left) === problemKey(right),
  );
  return { owners, problems };
};

export { ownerKeyOf, scanOwners };
export type { Owner, OwnerScan };
