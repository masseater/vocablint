import { layer } from "@effect/vitest";
import { Effect, Array as Arr, Record as Rec, pipe } from "effect";
import { expect } from "vite-plus/test";

import { findingsIn, fixtureLayer } from "./repository.test.support.ts";

const dependingOn = (...names: readonly string[]): string =>
  JSON.stringify({
    name: "fixture",
    dependencies: pipe(
      names,
      Arr.map((name) => [name, "1.0.0"] as const),
      Rec.fromEntries,
    ),
  });

const SORTER = {
  "node_modules/sorter/package.json": JSON.stringify({ name: "sorter", types: "./index.d.ts" }),
  "node_modules/sorter/index.d.ts": pipe(
    [
      'export type Order = "asc" | "desc";',
      "export declare function sort(order: Order): void;",
      'export declare function move(direction: "up" | "down"): void;',
      "export interface Page { order: Order; limit: number; offset: number; cursor: string }",
      "export interface Contract { paths: any; ids: any; routes: unknown }",
      "export declare function same<T>(left: T, right: T): void;",
      "export type Kind = 0 | 1 | 2 | 100;",
      "",
    ],
    Arr.join("\n"),
  ),
};

const BILLING = {
  "node_modules/billing/package.json": JSON.stringify({ name: "billing", types: "./index.d.ts" }),
  "node_modules/billing/index.d.ts": pipe(
    [
      "declare class Billing {}",
      "declare namespace Billing {",
      "  namespace Invoice {",
      '    type CollectionMethod = "charge_automatically" | "send_invoice";',
      "  }",
      "}",
      "export = Billing;",
      "",
    ],
    Arr.join("\n"),
  ),
};

const reportsSetsThatRestateAnExportedLibraryT = Effect.gen(
  function* reportsSetsThatRestateAnExportedLibraryT() {
    const findings = yield* findingsIn({
      ...SORTER,
      ...BILLING,
      "package.json": dependingOn("sorter", "billing"),
      "src/a.ts": pipe(
        [
          'export type Direction = "desc" | "asc";',
          'export type Method = "charge_automatically" | "send_invoice";',
          "",
        ],
        Arr.join("\n"),
      ),
    });
    expect(findings).toStrictEqual([
      "src/a.ts:1 library-value-set",
      "src/a.ts:2 library-value-set",
    ]);
  },
);

const namesTheLibrarySlotASetFlowsIntoEvenAnIn = Effect.gen(
  function* namesTheLibrarySlotASetFlowsIntoEvenAnIn() {
    const findings = yield* findingsIn({
      ...SORTER,
      "package.json": dependingOn("sorter"),
      "src/a.ts": pipe(
        [
          'import { move } from "sorter";',
          'type Step = "up" | "down";',
          "export const go = (step: Step): void => move(step);",
          "",
        ],
        Arr.join("\n"),
      ),
    });
    expect(findings).toStrictEqual(["src/a.ts:2 library-value-set"]);
  },
);

const acceptsSetsDerivedFromTheLibraryTypeAndL = Effect.gen(
  function* acceptsSetsDerivedFromTheLibraryTypeAndL() {
    const findings = yield* findingsIn({
      ...SORTER,
      "package.json": dependingOn("sorter"),
      "src/a.ts": pipe(
        [
          'import { sort, type Order } from "sorter";',
          'export type Ascending = Extract<Order, "asc">;',
          'sort("asc");',
          "",
        ],
        Arr.join("\n"),
      ),
    });
    expect(findings).toStrictEqual([]);
  },
);

const reportsObjectShapesCopiedFromALibraryTyp = Effect.gen(
  function* reportsObjectShapesCopiedFromALibraryTyp() {
    const findings = yield* findingsIn({
      ...SORTER,
      "package.json": dependingOn("sorter"),
      "src/a.ts": pipe(
        [
          'import type { Order, Page } from "sorter";',
          "export interface Copied { order: Order; limit: number; offset: number; cursor: string }",
          "export type Picked = { order: Order; limit: number; offset: number };",
          'export type Derived = Pick<Page, "order" | "limit" | "offset">;',
          "export interface Own { order: Order; limit: number; total: number }",
          "",
        ],
        Arr.join("\n"),
      ),
    });
    expect(findings).toStrictEqual(["src/a.ts:2 library-shape", "src/a.ts:3 library-shape"]);
  },
);

const acceptsKeySelectionsAndLooseLibraryContr = Effect.gen(
  function* acceptsKeySelectionsAndLooseLibraryContr() {
    const findings = yield* findingsIn({
      ...SORTER,
      "package.json": dependingOn("sorter"),
      "src/a.ts": pipe(
        [
          'import type { Page } from "sorter";',
          "interface Entry { slug: string; category: string; title: string }",
          'export type Key = Pick<Entry, "slug" | "category">;',
          'export type Window = Omit<Page, "order" | "cursor">;',
          "",
        ],
        Arr.join("\n"),
      ),
      "src/b.ts": pipe(
        [
          'import type { Entry } from "./c.ts";',
          'export type Key = Pick<Entry, "slug" | "category">;',
          'export interface Routes { paths: "/" | "/feed"; ids: "root" | "feed"; routes: string }',
          "",
        ],
        Arr.join("\n"),
      ),
      "src/c.ts": "export interface Entry { slug: string; category: string; title: string }\n",
    });
    expect(findings).toStrictEqual([]);
  },
);

const ignoresGenericSlotsNumericCoincidencesA = Effect.gen(
  function* ignoresGenericSlotsNumericCoincidencesA() {
    const findings = yield* findingsIn({
      ...SORTER,
      "package.json": dependingOn("sorter"),
      "src/a.ts": pipe(
        [
          'import { same } from "sorter";',
          'type State = "open" | "done";',
          "export const check = (state: State): void => same(state, state);",
          "export const SCALE = [0, 100] as const;",
          "",
        ],
        Arr.join("\n"),
      ),
      "src/generated.ts": pipe(
        [
          "// @ts-nocheck",
          'export type Paths = "/" | "/feed";',
          'export type To = "/" | "/feed";',
          "",
        ],
        Arr.join("\n"),
      ),
    });
    expect(findings).toStrictEqual([]);
  },
);

layer(fixtureLayer)("dependency types", (it) => {
  it.effect(
    "reports sets that restate an exported library type",
    () => reportsSetsThatRestateAnExportedLibraryT,
  );
  it.effect(
    "names the library slot a set flows into, even an inline parameter type",
    () => namesTheLibrarySlotASetFlowsIntoEvenAnIn,
  );
  it.effect(
    "accepts sets derived from the library type and literals passed to it",
    () => acceptsSetsDerivedFromTheLibraryTypeAndL,
  );
  it.effect(
    "reports object shapes copied from a library type",
    () => reportsObjectShapesCopiedFromALibraryTyp,
  );
  it.effect(
    "accepts key selections and implementations of loose library contracts",
    () => acceptsKeySelectionsAndLooseLibraryContr,
  );
  it.effect(
    "ignores generic library slots, numeric coincidences and files without type checking",
    () => ignoresGenericSlotsNumericCoincidencesA,
  );
});
