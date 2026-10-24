import { Array as Arr, Order, Record as Rec, pipe } from "effect";

import { OWNER_TAG } from "./owners.ts";
import { problemAt } from "./problem.ts";
import type { Problem } from "./problem.ts";
import type { ValueSite } from "./sites.ts";
import { lineOf } from "./syntax.ts";
import { formatValues, valueKey } from "./values.ts";

const DUPLICATE_THRESHOLD = 1;

const siteKey = (site: ValueSite): string =>
  `${site.node.getSourceFile().fileName}#${String(site.node.getStart())}`;

const valueSetKey = (site: ValueSite): string => {
  const keys = pipe(
    site.values,
    Arr.map((value) => valueKey(value)),
  );
  return pipe(Arr.sort(keys, Order.String), Arr.join("\0"));
};

const duplicateProblems =
  (relative: (file: string) => string) =>
  (sites: readonly ValueSite[]): readonly Problem[] => {
    const unique = Arr.dedupeWith(sites, (left, right) => siteKey(left) === siteKey(right));
    const groups = Rec.values(Arr.groupBy(unique, (site) => valueSetKey(site)));
    return pipe(
      groups,
      Arr.filter((group) => group.length > DUPLICATE_THRESHOLD),
      Arr.flatMap((group) =>
        pipe(
          group,
          Arr.map((site) => {
            const others = pipe(
              group,
              Arr.filter((other) => other !== site),
              Arr.map(
                (other) =>
                  `${relative(other.node.getSourceFile().fileName)}:${String(lineOf(other.node))}`,
              ),
              Arr.join(", "),
            );
            return problemAt({
              rule: "duplicate-value-set",
              message: `The values ${formatValues(site.values)} are also declared at ${others}. Register one owner with @${OWNER_TAG} and derive the others from it.`,
            })(site.node);
          }),
        ),
      ),
    );
  };

export { duplicateProblems };
