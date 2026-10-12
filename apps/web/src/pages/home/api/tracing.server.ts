// oxlint-disable-next-line import/no-nodejs-modules
import { AsyncLocalStorage } from "node:async_hooks";

import { tracing } from "cloudflare:workers";
import { Cause, Effect, Exit, Logger, Option, Predicate, Tracer } from "effect";

type RunInContext = ReturnType<typeof AsyncLocalStorage.snapshot>;
type SpanOptions =
  Parameters<Tracer.Tracer["span"]> extends readonly [infer Options] ? Options : never;
type CloudflareSpan = ReturnType<typeof tracing.startSpan>;

const isAttributeValue = Predicate.or(
  Predicate.or(Predicate.isString, Predicate.isNumber),
  Predicate.isBoolean,
);

const exitLabel = (exit: Exit.Exit<unknown, unknown>): string => {
  if (Exit.isSuccess(exit)) {
    return "success";
  }
  if (Cause.hasInterruptsOnly(exit.cause)) {
    return "interrupted";
  }
  return "failure";
};

class MirroredSpan extends Tracer.NativeSpan {
  public readonly runInContext: RunInContext;
  public readonly cloudflareSpan: Option.Option<CloudflareSpan>;

  public constructor(
    makeOptions: () => SpanOptions,
    runInContext: RunInContext,
    cloudflareSpan: Option.Option<CloudflareSpan>,
  ) {
    const options = makeOptions();
    super({
      ...options,
      sampled: options.sampled && Option.exists(cloudflareSpan, (span) => span.isTraced),
    });
    this.runInContext = runInContext;
    this.cloudflareSpan = cloudflareSpan;
  }

  public override attribute(key: string, value: unknown): void {
    super.attribute(key, value);
    if (isAttributeValue(value) && Option.isSome(this.cloudflareSpan)) {
      this.cloudflareSpan.value.setAttribute(key, value);
    }
  }

  public override end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
    super.end(endTime, exit);
    if (Option.isSome(this.cloudflareSpan)) {
      this.cloudflareSpan.value.setAttribute("effect.exit", exitLabel(exit));
      if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) {
        const message = Cause.pretty(exit.cause);
        this.cloudflareSpan.value.recordException({ message });
        this.cloudflareSpan.value.setStatus({ code: "error", message });
      }
      this.cloudflareSpan.value.end();
    }
  }
}

const contextFor = (span: Option.Option<Tracer.AnySpan>, fallback: RunInContext): RunInContext => {
  if (Option.isNone(span)) {
    return fallback;
  }
  if (span.value instanceof MirroredSpan) {
    return span.value.runInContext;
  }
  if (Predicate.isTagged(span.value, "Span")) {
    return contextFor(span.value.parent, fallback);
  }
  return fallback;
};

const makeTracer = (): Tracer.Tracer => {
  const invocationContext = AsyncLocalStorage.snapshot();
  return Tracer.make({
    span(options) {
      if (!options.sampled) {
        return new MirroredSpan(() => options, invocationContext, Option.none());
      }
      const startIn = (parentContext: RunInContext): Tracer.Span =>
        parentContext(() =>
          tracing.startActiveSpan(
            options.name,
            (span) =>
              new MirroredSpan(() => options, AsyncLocalStorage.snapshot(), Option.some(span)),
          ),
        );
      if (options.root) {
        return startIn(invocationContext);
      }
      return startIn(contextFor(options.parent, invocationContext));
    },
    context(primitive, fiber) {
      const run = contextFor(Option.fromUndefinedOr(fiber.cache.span), invocationContext);
      return run(() => primitive["~effect/Effect/evaluate"](fiber));
    },
  });
};

const spanFields = (span: Option.Option<Tracer.AnySpan>): Record<string, unknown> => {
  if (Option.isNone(span) || !Predicate.isTagged(span.value, "Span")) {
    return {};
  }
  if (span.value instanceof MirroredSpan) {
    return {
      span: span.value.name,
      traced: Option.exists(span.value.cloudflareSpan, (cloudflareSpan) => cloudflareSpan.isTraced),
    };
  }
  return { span: span.value.name };
};

const leveledLogger = Logger.withLeveledConsole(
  Logger.make((options) => ({
    ...Logger.formatStructured.log(options),
    ...spanFields(Option.fromUndefinedOr(options.fiber.cache.span)),
  })),
);

const cloudflareLogger = Logger.make((options) => {
  const run = contextFor(
    Option.fromUndefinedOr(options.fiber.cache.span),
    AsyncLocalStorage.snapshot(),
  );
  run(() => {
    leveledLogger.log(options);
  });
});

const withCloudflareTracing = <Success, Failure, Requirements>(
  effect: Effect.Effect<Success, Failure, Requirements>,
): Effect.Effect<Success, Failure, Requirements> => Effect.withTracer(effect, makeTracer());

export { cloudflareLogger, withCloudflareTracing };
