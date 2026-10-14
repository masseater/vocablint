# vocablint

vocablint keeps one owner for each set of values and object shape in a TypeScript repository.
It finds code that restates one already defined elsewhere.

A union such as `"asc" | "desc"` gets copied into a component, an API schema and a test. When someone adds `"none"` to one of them, the copies silently drift apart. vocablint reports each copy and names the owner to derive it from. An owner is a constant you register in your repository, or a type exported by a dependency. It runs on the TypeScript type checker alone, so it costs nothing to run and gives the same answer every time.

vocablint is not on npm yet. Build it from this repository as shown below.

## What it reports

- A set of values that restates a registered owner, or extends it with extra values
- A literal written by hand where a type derived from an owner is expected
- A set of values or an object shape that copies a type exported by a dependency
- The same unowned set of values declared in more than one place

## Build it

You need Node.js 22 or later and [Vite+](https://viteplus.dev/guide/) (`vp`).

```sh
git clone https://github.com/masseater/vocablint.git
cd vocablint
vp install
vp run --filter @r_masseater/vocablint build
```

The CLI is now at `tools/vocablint/dist/cli.mjs`.

## Use it

Register an owner by adding the `@vocablint` tag and a concept ID to a top-level `const`.

```ts
// src/sort.ts
/** @vocablint sort-order */
export const SORT_ORDERS = ["asc", "desc"] as const;
```

Then run the CLI at the root of your repository. It type-checks every `tsconfig.json` under the current directory.

```sh
node path/to/vocablint/tools/vocablint/dist/cli.mjs
```

A file that writes the same values again is reported, and the command exits with code 1.

```ts
// src/list.ts
export type Order = "asc" | "desc";
```

```text
src/list.ts:2:21 [owner-value-set] The values "asc" | "desc" are owned by sort-order (SORT_ORDERS). Derive this set from the owner instead of restating it.
```

Derive the type from the owner and the command exits with code 0.

```ts
// src/list.ts
import type { SORT_ORDERS } from "./sort.ts";

export type Order = (typeof SORT_ORDERS)[number];
```

Add `--json` to get the problems as a JSON array instead.
