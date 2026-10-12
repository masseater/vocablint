import { Effect } from "effect";

import { analyzeProject } from "./analysis.ts";
import { duplicateProblems } from "./duplicates.ts";
import { scanOwners } from "./owners.ts";
import { sortProblems } from "./problem.ts";
import { listConfigFiles, loadProjects } from "./project.ts";
import { RepositoryFiles } from "./repository-files.ts";

const checkRepository = Effect.fn("checkRepository")(function* checkRepository(root: string) {
  const files = yield* RepositoryFiles;
  const configPaths = yield* listConfigFiles(root);
  const projects = yield* loadProjects(root, configPaths);
  const ownerScan = scanOwners(projects);
  const analyses = projects.map((project) => analyzeProject(ownerScan.owners)(project));
  const relative = (file: string): string => files.relative(root, file);
  return sortProblems([
    ...ownerScan.problems,
    ...analyses.flatMap((analysis) => analysis.problems),
    ...duplicateProblems(relative)(analyses.flatMap((analysis) => analysis.unowned)),
  ]);
});

export { checkRepository };
