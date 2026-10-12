import { Array as Arr, Order } from "effect";

import { problemAt } from "./problem.ts";
import type { Problem } from "./problem.ts";
import type { ValueSite } from "./sites.ts";
import { lineOf } from "./syntax.ts";
import { formatValues, valueKey } from "./values.ts";

const DUPLICATE_THRESHOLD = 1;

const siteKey = (site: ValueSite): string =>
  `${site.node.getSourceFile().fileName}#${String(site.node.getStart())}`;

const valueSetKey = (site: ValueSite): string =>
  Arr.sort(
    site.values.map((value) => valueKey(value)),
    Order.String,
  ).join("\0");

const duplicateProblems =
  (relative: (file: string) => string) =>
  (sites: readonly ValueSite[]): readonly Problem[] => {
    const unique = Arr.dedupeWith(sites, (left, right) => siteKey(left) === siteKey(right));
    const groups = Object.values(Arr.groupBy(unique, (site) => valueSetKey(site)));
    return groups
      .filter((group) => group.length > DUPLICATE_THRESHOLD)
      .flatMap((group) =>
        group.map((site) => {
          const others = group
            .filter((other) => other !== site)
            .map(
              (other) =>
                `${relative(other.node.getSourceFile().fileName)}:${String(lineOf(other.node))}`,
            )
            .join(", ");
          return problemAt({
            rule: "duplicate-value-set",
            message: `The values ${formatValues(site.values)} are also declared at ${others}. Register one owner with @vocablint and derive the others from it.`,
          })(site.node);
        }),
      );
  };

export { duplicateProblems };
