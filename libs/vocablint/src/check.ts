import { Effect, Path } from "effect";

import { analyzeProject } from "./analysis.ts";
import { duplicateProblems } from "./duplicates.ts";
import { scanOwners } from "./owners.ts";
import { sortProblems } from "./problem.ts";
import { listConfigFiles, loadProjects } from "./project.ts";

const checkRepository = Effect.fn("checkRepository")(function* checkRepository(root: string) {
  const path = yield* Path.Path;
  const configPaths = yield* listConfigFiles(root);
  const projects = yield* loadProjects(root, configPaths);
  const ownerScan = scanOwners(projects);
  const analyses = projects.map((project) => analyzeProject(ownerScan.owners)(project));
  const relative = (file: string): string => path.relative(root, file);
  return sortProblems([
    ...ownerScan.problems,
    ...analyses.flatMap((analysis) => analysis.problems),
    ...duplicateProblems(relative)(analyses.flatMap((analysis) => analysis.unowned)),
  ]);
});

export { checkRepository };
