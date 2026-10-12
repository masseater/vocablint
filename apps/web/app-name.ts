import { Stack } from "alchemy";
import { Array as Arr, Effect, Option, Schema } from "effect";

const APP_NAME = "typescript-template";

const PREFIX = `${APP_NAME}-`;

const decodeNamed = Schema.decodeUnknownOption(Schema.Struct({ name: Schema.String }));

const describeUnprefixed = ({
  FQN,
  Props,
}: Readonly<{ FQN: string; Props: unknown }>): readonly string[] =>
  decodeNamed(Props).pipe(
    Option.filter(({ name }) => !name.startsWith(PREFIX)),
    Option.map(({ name }) => `${FQN}: ${name}`),
    Option.toArray,
  );

const requireAppPrefix = Effect.gen(function* requireAppPrefix() {
  const { name, resources } = yield* Stack;
  const offenders = [
    ...Arr.filter([`Stack: ${name}`], () => name !== APP_NAME),
    ...Object.values(resources).flatMap((resource) => describeUnprefixed(resource)),
  ];
  if (Arr.isReadonlyArrayNonEmpty(offenders)) {
    return yield* Effect.die(
      new Error(
        `Alchemy のスタック名は "${APP_NAME}"、リソース名は "${PREFIX}" で始める: ${offenders.join(", ")}`,
      ),
    );
  }
  return offenders;
});

export { APP_NAME, requireAppPrefix };
