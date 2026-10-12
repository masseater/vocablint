import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vite-plus/test";

import { findingsIn } from "./repository.test.support.ts";

const WITH_EFFECT = JSON.stringify({ name: "fixture", dependencies: { effect: "4.0.0" } });

const readsLiteralSetsFromSchemaLiteralsAndUni = Effect.gen(
  function* readsLiteralSetsFromSchemaLiteralsAndUni() {
    const findings = yield* findingsIn({
      "package.json": WITH_EFFECT,
      "src/a.ts": [
        'import { Schema } from "effect";',
        "/** @canonical-values order.status */",
        'export const OrderStatus = Schema.Literals(["draft", "published"]);',
        'export const Restated = Schema.Literals(["draft", "published"]);',
        'export const Unioned = Schema.Union([Schema.Literal("a"), Schema.Literal("b")]);',
        'export const Listed = Schema.Literals(["b", "a"]);',
        "",
      ].join("\n"),
    });
    expect(findings).toStrictEqual([
      "src/a.ts:4 owner-value-set",
      "src/a.ts:5 duplicate-value-set",
      "src/a.ts:6 duplicate-value-set",
    ]);
  },
);

const acceptsSchemasBuiltFromTheOwner = Effect.gen(function* acceptsSchemasBuiltFromTheOwner() {
  const findings = yield* findingsIn({
    "package.json": WITH_EFFECT,
    "src/a.ts": [
      'import { Schema } from "effect";',
      "/** @canonical-values order.status */",
      'export const OrderStatus = Schema.Literals(["draft", "published"]);',
      "export const Spread = Schema.Literals([...OrderStatus.literals]);",
      'export const Titled = OrderStatus.annotate({ title: "status" });',
      "export const Order = Schema.Struct({ id: Schema.String, status: OrderStatus });",
      "",
    ].join("\n"),
  });
  expect(findings).toStrictEqual([]);
});

layer(NodeServices.layer)("Effect Schema", (it) => {
  it.effect(
    "reads literal sets from Schema.Literals and unions of Schema.Literal",
    () => readsLiteralSetsFromSchemaLiteralsAndUni,
  );
  it.effect("accepts schemas built from the owner", () => acceptsSchemasBuiltFromTheOwner);
});
