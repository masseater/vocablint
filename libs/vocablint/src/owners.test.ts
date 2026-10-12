import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vite-plus/test";

import { findingsIn } from "./repository.test.support.ts";

const STATUS_OWNER = [
  "/** @vocablint order.status */",
  'export const ORDER_STATUSES = ["draft", "published", "archived"] as const;',
  "export type OrderStatus = (typeof ORDER_STATUSES)[number];",
  "",
].join("\n");

const reportsSetsThatRestateExtendOrSpellOutAn = Effect.gen(
  function* reportsSetsThatRestateExtendOrSpellOutAn() {
    const findings = yield* findingsIn({
      "src/status.ts": STATUS_OWNER,
      "src/use.ts": [
        'import type { OrderStatus } from "./status.ts";',
        'export type Local = "draft" | "published";',
        'export type Wider = OrderStatus | "deleted";',
        "export const set = (status: OrderStatus): OrderStatus => status;",
        'set("draft");',
        "",
      ].join("\n"),
    });
    expect(findings).toStrictEqual([
      "src/use.ts:2 owner-value-set",
      "src/use.ts:3 owner-extension",
      "src/use.ts:5 owned-literal",
    ]);
  },
);

const acceptsSetsDerivedFromTheOwner = Effect.gen(function* acceptsSetsDerivedFromTheOwner() {
  const findings = yield* findingsIn({
    "src/status.ts": STATUS_OWNER,
    "src/use.ts": [
      'import { ORDER_STATUSES, type OrderStatus } from "./status.ts";',
      'export type Published = Exclude<OrderStatus, "draft">;',
      'export type Early = Extract<OrderStatus, "draft" | "published">;',
      "export const copy = [...ORDER_STATUSES] as const;",
      "",
    ].join("\n"),
  });
  expect(findings).toStrictEqual([]);
});

const reportsAnnotationsThatCannotRegisterAnOw = Effect.gen(
  function* reportsAnnotationsThatCannotRegisterAnOw() {
    const findings = yield* findingsIn({
      "src/owners.ts": [
        "/** @vocablint */",
        'export const NAMELESS = ["a", "b"] as const;',
        "/** @vocablint letters */",
        "export const COUNT = 1;",
        "/** @vocablint letters */",
        'export type Letter = "a" | "b";',
        "/** @vocablint colors */",
        'export const COLORS = ["red", "blue"] as const;',
        "/** @vocablint colors */",
        'export const HUES = ["green", "cyan"] as const;',
        "/** @vocablint tones */",
        'export const TONES = ["red", "blue"] as const;',
        "",
      ].join("\n"),
    });
    expect(findings).toStrictEqual([
      "src/owners.ts:2 owner-annotation",
      "src/owners.ts:2 duplicate-value-set",
      "src/owners.ts:4 owner-annotation",
      "src/owners.ts:6 owner-annotation",
      "src/owners.ts:6 duplicate-value-set",
      "src/owners.ts:10 owner-annotation",
      "src/owners.ts:12 owner-annotation",
    ]);
  },
);

const reportsTheSameUnregisteredSetDeclaredTwi = Effect.gen(
  function* reportsTheSameUnregisteredSetDeclaredTwi() {
    const findings = yield* findingsIn({
      "src/a.ts": 'export type Mode = "light" | "dark";\n',
      "src/b.ts": 'export const MODES = ["dark", "light"] as const;\n',
    });
    expect(findings).toStrictEqual([
      "src/a.ts:1 duplicate-value-set",
      "src/b.ts:1 duplicate-value-set",
    ]);
  },
);

layer(NodeServices.layer)("repository owners", (it) => {
  it.effect(
    "reports sets that restate, extend or spell out an owner's values",
    () => reportsSetsThatRestateExtendOrSpellOutAn,
  );
  it.effect("accepts sets derived from the owner", () => acceptsSetsDerivedFromTheOwner);
  it.effect(
    "reports annotations that cannot register an owner",
    () => reportsAnnotationsThatCannotRegisterAnOw,
  );
  it.effect(
    "reports the same unregistered set declared twice",
    () => reportsTheSameUnregisteredSetDeclaredTwi,
  );
});
