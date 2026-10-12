import { Option } from "effect";
import ts from "typescript-6";

import { flowsIn } from "./flows.ts";
import { ownerKeyOf } from "./owners.ts";
import type { Owner } from "./owners.ts";
import type { Problem } from "./problem.ts";
import type { Project } from "./project.ts";
import { shapeProblemsIn } from "./shapes.ts";
import { sitesUnder } from "./sites.ts";
import type { ValueSite } from "./sites.ts";
import { descendantsOf } from "./syntax.ts";
import { ownedLiteralProblems, siteVerdict } from "./value-checks.ts";

interface ProjectAnalysis {
  readonly problems: readonly Problem[];
  readonly unowned: readonly ValueSite[];
}

const isVisibleTo =
  (project: Project) =>
  (owner: Owner): boolean =>
    project.sourceFiles.some(
      (sourceFile) => sourceFile.fileName === owner.declaration.getSourceFile().fileName,
    ) ||
    Option.exists(
      owner.packageName,
      (name) =>
        Option.contains(project.packageName, name) || project.workspaceDependencies.includes(name),
    );

const ownerDeclarationsIn = (
  project: Project,
  owners: readonly Owner[],
): readonly ts.VariableDeclaration[] => {
  const keys = new Set(owners.map((owner) => owner.key));
  return project.sourceFiles.flatMap((sourceFile) =>
    descendantsOf(sourceFile)
      .filter((node) => ts.isVariableDeclaration(node))
      .filter((declaration) => Option.exists(ownerKeyOf(declaration), (key) => keys.has(key))),
  );
};

const isInside =
  (outers: readonly ts.Node[]) =>
  (node: ts.Node): boolean =>
    outers.some(
      (outer) =>
        outer.getSourceFile() === node.getSourceFile() &&
        outer.getStart() <= node.getStart() &&
        node.getEnd() <= outer.getEnd(),
    );

const analyzeProject =
  (owners: readonly Owner[]) =>
  (project: Project): ProjectAnalysis => {
    const checker = project.program.getTypeChecker();
    const ownerDeclarations = ownerDeclarationsIn(project, owners);
    const sites = project.sourceFiles
      .flatMap((sourceFile) => sitesUnder(checker)(sourceFile))
      .filter((site) => !isInside(ownerDeclarations)(site.node));
    const flowContext = { checker, program: project.program, sites };
    const context = {
      checker,
      owners: owners.filter((owner) => isVisibleTo(project)(owner)),
      vocabularies: project.library.vocabularies,
      flows: project.sourceFiles.flatMap((sourceFile) => flowsIn(flowContext)(sourceFile)),
    };
    const verdicts = sites.map((site) => siteVerdict(context)(site));
    const excluded = [...ownerDeclarations, ...sites.map((site) => site.node)];
    return {
      problems: [
        ...verdicts.flatMap((found) => found.problems),
        ...project.sourceFiles.flatMap((sourceFile) =>
          ownedLiteralProblems(context)(sourceFile, excluded),
        ),
        ...project.sourceFiles.flatMap((sourceFile) =>
          shapeProblemsIn({ checker, shapes: project.library.shapes })(sourceFile),
        ),
      ],
      unowned: verdicts.flatMap((found) => found.unowned),
    };
  };

export { analyzeProject };
export type { ProjectAnalysis };
