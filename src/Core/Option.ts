import { WithKind, WithValue } from "./InternalTypes.ts";
import { Result } from "./Result.ts";

/**
 * Option represents an optional value: every Option is either Some (contains a value) or None (empty).
 * Use Option instead of null/undefined to make optionality explicit and composable.
 *
 * @example
 * ```ts
 * const findUser = (id: string): Option<User> =>
 *   users.has(id) ? Option.some(users.get(id)!) : Option.none();
 *
 * pipe(
 *   findUser("123"),
 *   Option.map(user => user.name),
 *   Option.getOrElse("Unknown")
 * );
 * ```
 */
export type Option<T> = Some<T> | None;

export type Some<A> = WithKind<"Some"> & WithValue<A>;
export type None = WithKind<"None">;

export namespace Option {
  /**
   * Creates a Some containing the given value.
   */
  export const some = <A>(value: A): Some<A> => ({ kind: "Some", value });

  /**
   * Type guard that checks if a Option is Some.
   */
  export const isSome = <A>(data: Option<A>): data is Some<A> => data.kind === "Some";

  /**
   * Creates a None (empty Option).
   */
  export const none = (): None => ({ kind: "None" });

  /**
   * Type guard that checks if a Option is None.
   */
  export const isNone = <A>(data: Option<A>): data is None => data.kind === "None";

  /**
   * Creates a Option from a nullable value.
   * Returns None if the value is null or undefined, Some otherwise.
   *
   * @example
   * ```ts
   * Option.fromNullable(null); // None
   * Option.fromNullable(42); // Some(42)
   * ```
   */
  export const fromNullable = <A>(value: A | null | undefined): Option<A> =>
    value === null || value === undefined ? none() : some(value);

  /**
   * Extracts the value from a Option, returning null if None.
   */
  export const toNullable = <A>(data: Option<A>): A | null => isSome(data) ? data.value : null;

  /**
   * Extracts the value from a Option, returning undefined if None.
   */
  export const toUndefined = <A>(data: Option<A>): A | undefined =>
    isSome(data) ? data.value : undefined;

  /**
   * Creates a Option from a possibly undefined value.
   * Returns None if undefined, Some otherwise.
   */
  export const fromUndefined = <A>(value: A | undefined): Option<A> =>
    value === undefined ? none() : some(value);

  /**
   * Converts an Option to a Result.
   * Some becomes Ok, None becomes Err with the provided error.
   *
   * @example
   * ```ts
   * pipe(
   *   Option.some(42),
   *   Option.toResult(() => "Value was missing")
   * ); // Ok(42)
   *
   * pipe(
   *   Option.none(),
   *   Option.toResult(() => "Value was missing")
   * ); // Err("Value was missing")
   * ```
   */
  export const toResult = <E>(onNone: () => E) => <A>(data: Option<A>): Result<E, A> =>
    isSome(data) ? Result.ok(data.value) : Result.err(onNone());

  /**
   * Creates an Option from a Result.
   * Ok becomes Some, Err becomes None (the error is discarded).
   *
   * @example
   * ```ts
   * Option.fromResult(Result.ok(42)); // Some(42)
   * Option.fromResult(Result.err("oops")); // None
   * ```
   */
  export const fromResult = <E, A>(data: Result<E, A>): Option<A> =>
    Result.isOk(data) ? some(data.value) : none();

  /**
   * Transforms the value inside a Option if it exists.
   *
   * @example
   * ```ts
   * pipe(Option.some(5), Option.map(n => n * 2)); // Some(10)
   * pipe(Option.none(), Option.map(n => n * 2)); // None
   * ```
   */
  export const map = <A, B>(f: (a: A) => B) => (data: Option<A>): Option<B> =>
    isSome(data) ? some(f(data.value)) : data;

  /**
   * Chains Option computations. If the first is Some, passes the value to f.
   * If the first is None, propagates None.
   *
   * @example
   * ```ts
   * const parseNumber = (s: string): Option<number> => {
   *   const n = parseInt(s, 10);
   *   return isNaN(n) ? Option.none() : Option.some(n);
   * };
   *
   * pipe(Option.some("42"), Option.chain(parseNumber)); // Some(42)
   * pipe(Option.some("abc"), Option.chain(parseNumber)); // None
   * ```
   */
  export const chain = <A, B>(f: (a: A) => Option<B>) => (data: Option<A>): Option<B> =>
    isSome(data) ? f(data.value) : data;

  /**
   * Extracts the value from a Option by providing handlers for both cases.
   *
   * @example
   * ```ts
   * pipe(
   *   Option.some(5),
   *   Option.fold(
   *     () => "No value",
   *     n => `Value: ${n}`
   *   )
   * ); // "Value: 5"
   * ```
   */
  export const fold = <A, B>(onNone: () => B, onSome: (a: A) => B) => (data: Option<A>): B =>
    isSome(data) ? onSome(data.value) : onNone();

  /**
   * Pattern matches on a Option, returning the result of the matching case.
   *
   * @example
   * ```ts
   * pipe(
   *   optionUser,
   *   Option.match({
   *     some: user => `Hello, ${user.name}`,
   *     none: () => "Hello, stranger"
   *   })
   * );
   * ```
   */
  export const match =
    <A, B>(cases: { none: () => B; some: (a: A) => B }) => (data: Option<A>): B =>
      isSome(data) ? cases.some(data.value) : cases.none();

  /**
   * Returns the value inside an Option, or a default value if None.
   * The default is a thunk `() => B` — evaluated only when the Option is None.
   * The default can be a different type, widening the result to `A | B`.
   *
   * @example
   * ```ts
   * pipe(Option.some(5), Option.getOrElse(() => 0)); // 5
   * pipe(Option.none(), Option.getOrElse(() => 0)); // 0
   * pipe(Option.none<string>(), Option.getOrElse(() => null)); // null — typed as string | null
   * ```
   */
  export const getOrElse = <A, B>(defaultValue: () => B) => (data: Option<A>): A | B =>
    isSome(data) ? data.value : defaultValue();

  /**
   * Executes a side effect on the value without changing the Option.
   * Useful for logging or debugging.
   *
   * @example
   * ```ts
   * pipe(
   *   Option.some(5),
   *   Option.tap(n => console.log("Value:", n)),
   *   Option.map(n => n * 2)
   * );
   * ```
   */
  export const tap = <A>(f: (a: A) => void) => (data: Option<A>): Option<A> => {
    if (isSome(data)) f(data.value);
    return data;
  };

  /**
   * Filters a Option based on a predicate.
   * Returns None if the predicate returns false or if the Option is already None.
   *
   * @example
   * ```ts
   * pipe(Option.some(5), Option.filter(n => n > 3)); // Some(5)
   * pipe(Option.some(2), Option.filter(n => n > 3)); // None
   * ```
   */
  export const filter = <A>(predicate: (a: A) => boolean) => (data: Option<A>): Option<A> =>
    isSome(data) ? (predicate(data.value) ? data : none()) : data;

  /**
   * Recovers from a None by providing a fallback Option.
   * The fallback can produce a different type, widening the result to `Option<A | B>`.
   */
  export const recover = <A, B>(fallback: () => Option<B>) => (data: Option<A>): Option<A | B> =>
    isSome(data) ? data : fallback();

  /**
   * Applies a function wrapped in a Option to a value wrapped in a Option.
   *
   * @example
   * ```ts
   * const add = (a: number) => (b: number) => a + b;
   * pipe(
   *   Option.some(add),
   *   Option.ap(Option.some(5)),
   *   Option.ap(Option.some(3))
   * ); // Some(8)
   * ```
   */
  export const ap = <A>(arg: Option<A>) => <B>(data: Option<(a: A) => B>): Option<B> =>
    isSome(data) && isSome(arg) ? some(data.value(arg.value)) : none();
}
