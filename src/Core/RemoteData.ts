import { WithError, WithKind, WithValue } from "./InternalTypes.ts";

/**
 * RemoteData represents the state of an async data fetch.
 * It has four states: NotAsked, Loading, Failure, and Success.
 *
 * Use RemoteData to model data fetching states explicitly,
 * replacing the common `{ data: T | null; loading: boolean; error: Error | null }` pattern.
 *
 * @example
 * ```ts
 * const renderUser = pipe(
 *   userData,
 *   RemoteData.match({
 *     notAsked: () => "Click to load",
 *     loading: () => "Loading...",
 *     failure: e => `Error: ${e.message}`,
 *     success: user => `Hello, ${user.name}!`
 *   })
 * );
 * ```
 */
export type RemoteData<E, A> = NotAsked | Loading | Failure<E> | Success<A>;

export type NotAsked = WithKind<"NotAsked">;
export type Loading = WithKind<"Loading">;
export type Failure<E> = WithKind<"Failure"> & WithError<E>;
export type Success<A> = WithKind<"Success"> & WithValue<A>;

export namespace RemoteData {
  /**
   * Creates a NotAsked RemoteData.
   */
  export const notAsked = <E, A>(): RemoteData<E, A> => ({ kind: "NotAsked" });

  /**
   * Creates a Loading RemoteData.
   */
  export const loading = <E, A>(): RemoteData<E, A> => ({ kind: "Loading" });

  /**
   * Creates a Failure RemoteData with the given error.
   */
  export const failure = <E, A>(error: E): RemoteData<E, A> => ({
    kind: "Failure",
    error,
  });

  /**
   * Creates a Success RemoteData with the given value.
   */
  export const success = <E, A>(value: A): RemoteData<E, A> => ({
    kind: "Success",
    value,
  });

  /**
   * Type guard that checks if a RemoteData is NotAsked.
   */
  export const isNotAsked = <E, A>(data: RemoteData<E, A>): data is NotAsked =>
    data.kind === "NotAsked";

  /**
   * Type guard that checks if a RemoteData is Loading.
   */
  export const isLoading = <E, A>(data: RemoteData<E, A>): data is Loading =>
    data.kind === "Loading";

  /**
   * Type guard that checks if a RemoteData is Failure.
   */
  export const isFailure = <E, A>(data: RemoteData<E, A>): data is Failure<E> =>
    data.kind === "Failure";

  /**
   * Type guard that checks if a RemoteData is Success.
   */
  export const isSuccess = <E, A>(data: RemoteData<E, A>): data is Success<A> =>
    data.kind === "Success";

  /**
   * Transforms the success value inside a RemoteData.
   *
   * @example
   * ```ts
   * pipe(RemoteData.success(5), RemoteData.map(n => n * 2)); // Success(10)
   * pipe(RemoteData.loading(), RemoteData.map(n => n * 2)); // Loading
   * ```
   */
  export const map = <A, B>(f: (a: A) => B) => <E>(data: RemoteData<E, A>): RemoteData<E, B> =>
    isSuccess(data) ? success(f(data.value)) : (data as RemoteData<E, B>);

  /**
   * Transforms the error value inside a RemoteData.
   *
   * @example
   * ```ts
   * pipe(RemoteData.failure("oops"), RemoteData.mapError(e => e.toUpperCase())); // Failure("OOPS")
   * ```
   */
  export const mapError = <E, F>(f: (e: E) => F) => <A>(data: RemoteData<E, A>): RemoteData<F, A> =>
    isFailure(data) ? failure(f(data.error)) : (data as RemoteData<F, A>);

  /**
   * Chains RemoteData computations. If the input is Success, passes the value to f.
   * Otherwise, propagates the current state.
   *
   * @example
   * ```ts
   * pipe(
   *   RemoteData.success(5),
   *   RemoteData.chain(n => n > 0 ? RemoteData.success(n) : RemoteData.failure("negative"))
   * );
   * ```
   */
  export const chain =
    <E, A, B>(f: (a: A) => RemoteData<E, B>) => (data: RemoteData<E, A>): RemoteData<E, B> =>
      isSuccess(data) ? f(data.value) : (data as RemoteData<E, B>);

  /**
   * Applies a function wrapped in a RemoteData to a value wrapped in a RemoteData.
   *
   * @example
   * ```ts
   * const add = (a: number) => (b: number) => a + b;
   * pipe(
   *   RemoteData.success(add),
   *   RemoteData.ap(RemoteData.success(5)),
   *   RemoteData.ap(RemoteData.success(3))
   * ); // Success(8)
   * ```
   */
  export const ap =
    <E, A>(arg: RemoteData<E, A>) => <B>(data: RemoteData<E, (a: A) => B>): RemoteData<E, B> => {
      if (isSuccess(data) && isSuccess(arg)) {
        return success(data.value(arg.value));
      }
      if (isFailure(data)) return data;
      if (isFailure(arg)) return arg;
      if (isLoading(data) || isLoading(arg)) return loading();
      return notAsked();
    };

  /**
   * Extracts the value from a RemoteData by providing handlers for all four cases.
   *
   * @example
   * ```ts
   * pipe(
   *   userData,
   *   RemoteData.fold(
   *     () => "Not asked",
   *     () => "Loading...",
   *     e => `Error: ${e}`,
   *     value => `Got: ${value}`
   *   )
   * );
   * ```
   */
  export const fold = <E, A, B>(
    onNotAsked: () => B,
    onLoading: () => B,
    onFailure: (e: E) => B,
    onSuccess: (a: A) => B,
  ) =>
  (data: RemoteData<E, A>): B => {
    switch (data.kind) {
      case "NotAsked":
        return onNotAsked();
      case "Loading":
        return onLoading();
      case "Failure":
        return onFailure(data.error);
      case "Success":
        return onSuccess(data.value);
    }
  };

  /**
   * Pattern matches on a RemoteData, returning the result of the matching case.
   *
   * @example
   * ```ts
   * pipe(
   *   userData,
   *   RemoteData.match({
   *     notAsked: () => "Click to load",
   *     loading: () => "Loading...",
   *     failure: e => `Error: ${e}`,
   *     success: user => `Hello, ${user.name}!`
   *   })
   * );
   * ```
   */
  export const match = <E, A, B>(cases: {
    notAsked: () => B;
    loading: () => B;
    failure: (e: E) => B;
    success: (a: A) => B;
  }) =>
  (data: RemoteData<E, A>): B => {
    switch (data.kind) {
      case "NotAsked":
        return cases.notAsked();
      case "Loading":
        return cases.loading();
      case "Failure":
        return cases.failure(data.error);
      case "Success":
        return cases.success(data.value);
    }
  };

  /**
   * Returns the success value or a default value if the RemoteData is not Success.
   * The default can be a different type, widening the result to `A | B`.
   *
   * @example
   * ```ts
   * pipe(RemoteData.success(5), RemoteData.getOrElse(0)); // 5
   * pipe(RemoteData.loading(), RemoteData.getOrElse(0)); // 0
   * pipe(RemoteData.loading<string, number>(), RemoteData.getOrElse(null)); // null — typed as number | null
   * ```
   */
  export const getOrElse = <E, A, B>(defaultValue: () => B) => (data: RemoteData<E, A>): A | B =>
    isSuccess(data) ? data.value : defaultValue();

  /**
   * Executes a side effect on the success value without changing the RemoteData.
   *
   * @example
   * ```ts
   * pipe(
   *   RemoteData.success(5),
   *   RemoteData.tap(n => console.log("Value:", n)),
   *   RemoteData.map(n => n * 2)
   * );
   * ```
   */
  export const tap = <E, A>(f: (a: A) => void) => (data: RemoteData<E, A>): RemoteData<E, A> => {
    if (isSuccess(data)) f(data.value);
    return data;
  };

  /**
   * Recovers from a Failure state by providing a fallback RemoteData.
   * The fallback can produce a different success type, widening the result to `RemoteData<E, A | B>`.
   */
  export const recover =
    <E, A, B>(fallback: (e: E) => RemoteData<E, B>) =>
    (data: RemoteData<E, A>): RemoteData<E, A | B> => isFailure(data) ? fallback(data.error) : data;

  /**
   * Converts a RemoteData to an Option.
   * Success becomes Some, all other states become None.
   */
  export const toOption = <E, A>(
    data: RemoteData<E, A>,
  ): import("./Option.ts").Option<A> =>
    isSuccess(data) ? { kind: "Some", value: data.value } : { kind: "None" };

  /**
   * Converts a RemoteData to a Result.
   * Success becomes Ok, Failure becomes Err.
   * NotAsked and Loading become Err with the provided fallback error.
   *
   * @example
   * ```ts
   * pipe(
   *   RemoteData.success(42),
   *   RemoteData.toResult(() => "not loaded")
   * ); // Ok(42)
   * ```
   */
  export const toResult =
    <E>(onNotReady: () => E) => <A>(data: RemoteData<E, A>): import("./Result.ts").Result<E, A> =>
      isSuccess(data)
        ? { kind: "Ok", value: data.value }
        : { kind: "Error", error: isFailure(data) ? data.error : onNotReady() };
}
