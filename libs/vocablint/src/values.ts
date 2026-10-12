import { Array as Arr, Function as Fn, Option } from "effect";
import ts from "typescript-6";

type Value = string | number;

interface Vocabulary {
  readonly values: readonly Value[];
  readonly admitsUnnamedValues: boolean;
}

const SCHEMA_TYPE_PROPERTIES = ["Type", "_output"] as const;

const MINIMUM_SET_SIZE = 2;

const DATA_FIRST_ARITY = 2;

const valueKey = (value: Value): string => `${typeof value}:${String(value)}`;

const literalValueOf = (type: ts.Type): Option.Option<Value> => {
  if (type.isStringLiteral() || type.isNumberLiteral()) {
    return Option.some(type.value);
  }
  return Option.none();
};

const literalValuesOf = (types: readonly ts.Type[]): Option.Option<readonly Value[]> => {
  const values = Arr.dedupeWith(
    Arr.getSomes(types.map((member) => literalValueOf(member))),
    (left, right) => valueKey(left) === valueKey(right),
  );
  if (values.length !== types.length || values.length < MINIMUM_SET_SIZE) {
    return Option.none();
  }
  return Option.some(values);
};

const literalUnionOf = (type: ts.Type): Option.Option<readonly Value[]> => {
  if (!type.isUnion()) {
    return Option.none();
  }
  return literalValuesOf(type.types);
};

const elementTypeOf = (checker: ts.TypeChecker, type: ts.Type): Option.Option<ts.Type> => {
  if (!checker.isArrayLikeType(type)) {
    return Option.none();
  }
  return Option.fromUndefinedOr(checker.getIndexTypeOfType(type, ts.IndexKind.Number));
};

const schemaTypeOf =
  (checker: ts.TypeChecker) =>
  (type: ts.Type): Option.Option<ts.Type> =>
    Arr.findFirst(SCHEMA_TYPE_PROPERTIES, (name) =>
      Option.fromUndefinedOr(checker.getPropertyOfType(type, name)),
    ).pipe(Option.map((property) => checker.getTypeOfSymbol(property)));

const finiteValuesOf =
  (checker: ts.TypeChecker) =>
  (type: ts.Type): Option.Option<readonly Value[]> =>
    literalUnionOf(type).pipe(
      Option.orElse(() => elementTypeOf(checker, type).pipe(Option.flatMap(literalUnionOf))),
      Option.orElse(() => schemaTypeOf(checker)(type).pipe(Option.flatMap(literalUnionOf))),
    );

const isOptionalMember = (checker: ts.TypeChecker, member: ts.Type): boolean =>
  member === checker.getUndefinedType() || member === checker.getNullType();

const vocabularyOf =
  (checker: ts.TypeChecker) =>
  (type: ts.Type): Option.Option<Vocabulary> => {
    if (!type.isUnion()) {
      return Option.none();
    }
    const members = type.types.filter((member) => !isOptionalMember(checker, member));
    const values = Arr.getSomes(members.map((member) => literalValueOf(member)));
    if (values.length < MINIMUM_SET_SIZE) {
      return Option.none();
    }
    return Option.some({ values, admitsUnnamedValues: values.length !== members.length });
  };

const isSubsetOf: {
  (superset: readonly Value[]): (subset: readonly Value[]) => boolean;
  (subset: readonly Value[], superset: readonly Value[]): boolean;
} = Fn.dual(DATA_FIRST_ARITY, (subset: readonly Value[], superset: readonly Value[]): boolean => {
  const held = new Set(superset.map((value) => valueKey(value)));
  return subset.every((value) => held.has(valueKey(value)));
});

const sameValues: {
  (right: readonly Value[]): (left: readonly Value[]) => boolean;
  (left: readonly Value[], right: readonly Value[]): boolean;
} = Fn.dual(
  DATA_FIRST_ARITY,
  (left: readonly Value[], right: readonly Value[]): boolean =>
    left.length === right.length && isSubsetOf(left, right),
);

const formatValues = (values: readonly Value[]): string =>
  values.map((value) => JSON.stringify(value)).join(" | ");

export {
  finiteValuesOf,
  formatValues,
  isSubsetOf,
  literalUnionOf,
  literalValuesOf,
  sameValues,
  schemaTypeOf,
  valueKey,
  vocabularyOf,
};
export type { Value, Vocabulary };
