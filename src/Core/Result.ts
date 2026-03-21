import { WithError, WithKind, WithValue } from "./InternalTypes.ts";
import { Option } from "./Option.ts";

/**
 * Result represents a value that can be one of two types: a success (Ok) or a failure (Err).
 * Use Result when an operation can fail with a meaningful error value.
 *
 * @example
 * ```ts
 * const divide = (a: number, b: number): Result<string, number> =>
 *   b === 0 ? Result.err("Division by zero") : Result.ok(a / b);
 *
 * pipe(
 *   divide(10, 2),
 *   Result.map(n => n * 2),
 *   Result.getOrElse(0)
 * ); // 10
 * ```
 */
export type Result<E, A> = Ok<A> | Err<E>;

export type Ok<A> = WithKind<"Ok"> & WithValue<A>;
export type Err<E> = WithKind<"Error"> & WithError<E>;

export namespace Result {
  /**
   * Creates a successful Result with the given value.
   */
  export const ok = <A>(value: A): Ok<A> => ({ kind: "Ok", value });

  /**
   * Creates a failed Result with the given error.
   */
  export const err = <E>(error: E): Err<E> => ({ kind: "Error", error });

  /**
   * Type guard that checks if an Result is Ok.
   */
  export const isOk = <E, A>(data: Result<E, A>): data is Ok<A> => data.kind === "Ok";

  /**
   * Type guard that checks if an Result is Err.
   */
  export const isErr = <E, A>(data: Result<E, A>): data is Err<E> => data.kind === "Error";

  /**
   * Creates an Result from a function that may throw.
   * Catches any errors and transforms them using the onError function.
   *
   * @example
   * ```ts
   * const parseJson = (s: string): Result<string, unknown> =>
   *   Result.tryCatch(
   *     () => JSON.parse(s),
   *     (e) => `Parse error: ${e}`
   *   );
   * ```
   */
  export const tryCatch = <E, A>(
    f: () => A,
    onError: (e: unknown) => E,
  ): Result<E, A> => {
    try {
      return ok(f());
    } catch (e) {
      return err(onError(e));
    }
  };

  /**
   * Transforms the success value inside an Result.
   *
   * @example
   * ```ts
   * pipe(Result.ok(5), Result.map(n => n * 2)); // Ok(10)
   * pipe(Result.err("error"), Result.map(n => n * 2)); // Err("error")
   * ```
   */
  export const map = <E, A, B>(f: (a: A) => B) => (data: Result<E, A>): Result<E, B> =>
    isOk(data) ? ok(f(data.value)) : data;

  /**
   * Transforms the error value inside an Result.
   *
   * @example
   * ```ts
   * pipe(Result.err("oops"), Result.mapError(e => e.toUpperCase())); // Err("OOPS")
   * ```
   */
  export const mapError = <E, F, A>(f: (e: E) => F) => (data: Result<E, A>): Result<F, A> =>
    isErr(data) ? err(f(data.error)) : data;

  /**
   * Chains Result computations. If the first is Ok, passes the value to f.
   * If the first is Err, propagates the error.
   *
   * @example
   * ```ts
   * const validatePositive = (n: number): Result<string, number> =>
   *   n > 0 ? Result.ok(n) : Result.err("Must be positive");
   *
   * pipe(Result.ok(5), Result.chain(validatePositive)); // Ok(5)
   * pipe(Result.ok(-1), Result.chain(validatePositive)); // Err("Must be positive")
   * ```
   */
  export const chain = <E, A, B>(f: (a: A) => Result<E, B>) => (data: Result<E, A>): Result<E, B> =>
    isOk(data) ? f(data.value) : data;

  /**
   * Extracts the value from an Result by providing handlers for both cases.
   *
   * @example
   * ```ts
   * pipe(
   *   Result.ok(5),
   *   Result.fold(
   *     e => `Error: ${e}`,
   *     n => `Value: ${n}`
   *   )
   * ); // "Value: 5"
   * ```
   */
  export const fold = <E, A, B>(onErr: (e: E) => B, onOk: (a: A) => B) => (data: Result<E, A>): B =>
    isOk(data) ? onOk(data.value) : onErr(data.error);

  /**
   * Pattern matches on a Result, returning the result of the matching case.
   *
   * @example
   * ```ts
   * pipe(
   *   result,
   *   Result.match({
   *     ok: value => `Got ${value}`,
   *     err: error => `Failed: ${error}`
   *   })
   * );
   * ```
   */
  export const match =
    <E, A, B>(cases: { ok: (a: A) => B; err: (e: E) => B }) => (data: Result<E, A>): B =>
      isOk(data) ? cases.ok(data.value) : cases.err(data.error);

  /**
   * Returns the success value or a default value if the Result is an error.
   * The default is a thunk `() => B` — evaluated only when the Result is Err.
   * The default can be a different type, widening the result to `A | B`.
   *
   * @example
   * ```ts
   * pipe(Result.ok(5), Result.getOrElse(() => 0)); // 5
   * pipe(Result.err("error"), Result.getOrElse(() => 0)); // 0
   * pipe(Result.err("error"), Result.getOrElse(() => null)); // null — typed as number | null
   * ```
   */
  export const getOrElse = <E, A, B>(defaultValue: () => B) => (data: Result<E, A>): A | B =>
    isOk(data) ? data.value : defaultValue();

  /**
   * Executes a side effect on the success value without changing the Result.
   * Useful for logging or debugging.
   *
   * @example
   * ```ts
   * pipe(
   *   Result.ok(5),
   *   Result.tap(n => console.log("Value:", n)),
   *   Result.map(n => n * 2)
   * );
   * ```
   */
  export const tap = <E, A>(f: (a: A) => void) => (data: Result<E, A>): Result<E, A> => {
    if (isOk(data)) f(data.value);
    return data;
  };

  /**
   * Recovers from an error by providing a fallback Result.
   * The fallback can produce a different success type, widening the result to `Result<E, A | B>`.
   */
  export const recover =
    <E, A, B>(fallback: (e: E) => Result<E, B>) => (data: Result<E, A>): Result<E, A | B> =>
      isOk(data) ? data : fallback(data.error);

  /**
   * Recovers from an error unless it matches the blocked error.
   * The fallback can produce a different success type, widening the result to `Result<E, A | B>`.
   */
  export const recoverUnless =
    <E, A, B>(blockedErr: E, fallback: () => Result<E, B>) =>
    (data: Result<E, A>): Result<E, A | B> =>
      isErr(data) && data.error !== blockedErr ? fallback() : data;

  /**
   * Converts a Result to an Option.
   * Ok becomes Some, Err becomes None (the error is discarded).
   *
   * @example
   * ```ts
   * Result.toOption(Result.ok(42)); // Some(42)
   * Result.toOption(Result.err("oops")); // None
   * ```
   */
  export const toOption = <E, A>(data: Result<E, A>): Option<A> =>
    isOk(data) ? Option.some(data.value) : Option.none();

  /**
   * Applies a function wrapped in an Result to a value wrapped in an Result.
   *
   * @example
   * ```ts
   * const add = (a: number) => (b: number) => a + b;
   * pipe(
   *   Result.ok(add),
   *   Result.ap(Result.ok(5)),
   *   Result.ap(Result.ok(3))
   * ); // Ok(8)
   * ```
   */
  export const ap = <E, A>(arg: Result<E, A>) => <B>(data: Result<E, (a: A) => B>): Result<E, B> =>
    isOk(data) && isOk(arg) ? ok(data.value(arg.value)) : isErr(data) ? data : (arg as Err<E>);
}
