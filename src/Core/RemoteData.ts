// =============================================================================
// Imports
// =============================================================================
import { type Maybe, Maybe as CoreMaybe, type Result, Result as CoreResult } from "#core";
import type { WithError, WithKind, WithValue } from "#internal";

// =============================================================================
// Types
// =============================================================================
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

// =============================================================================
// Private Helpers & Variant Constructors
// =============================================================================
const _notAsked: NotAsked = { kind: "NotAsked" };
const _loading: Loading = { kind: "Loading" };

const makeNotAsked = (): NotAsked => _notAsked;
const makeLoading = (): Loading => _loading;
const makeFailure = <E>(error: E): Failure<E> => ({ kind: "Failure", error });
const makeSuccess = <A>(value: A): Success<A> => ({ kind: "Success", value });

const isNotAsked = <E, A>(data: RemoteData<E, A>): data is NotAsked => data.kind === "NotAsked";
const isLoading = <E, A>(data: RemoteData<E, A>): data is Loading => data.kind === "Loading";
const isFailure = <E, A>(data: RemoteData<E, A>): data is Failure<E> => data.kind === "Failure";
const isSuccess = <E, A>(data: RemoteData<E, A>): data is Success<A> => data.kind === "Success";

// =============================================================================
// Public Export
// =============================================================================
export const RemoteData = {
	make: {
		/**
		 * Creates a NotAsked RemoteData.
		 *
		 * @example
		 * ```ts
		 * RemoteData.make.notAsked(); // NotAsked
		 * ```
		 */
		notAsked: makeNotAsked,

		/**
		 * Creates a Loading RemoteData.
		 *
		 * @example
		 * ```ts
		 * RemoteData.make.loading(); // Loading
		 * ```
		 */
		loading: makeLoading,

		/**
		 * Creates a Failure RemoteData with the given error.
		 *
		 * @example
		 * ```ts
		 * RemoteData.make.failure("Network error"); // Failure("Network error")
		 * ```
		 */
		failure: makeFailure,

		/**
		 * Creates a Success RemoteData with the given value.
		 *
		 * @example
		 * ```ts
		 * RemoteData.make.success(42); // Success(42)
		 * ```
		 */
		success: makeSuccess,
	},

	is: {
		/**
		 * Type guard that checks if a RemoteData is NotAsked.
		 *
		 * @example
		 * ```ts
		 * const data = RemoteData.make.notAsked();
		 * if (RemoteData.is.notAsked(data)) {
		 *   console.log("Data fetch not initiated");
		 * }
		 * ```
		 */
		notAsked: isNotAsked,

		/**
		 * Type guard that checks if a RemoteData is Loading.
		 *
		 * @example
		 * ```ts
		 * const data = RemoteData.make.loading();
		 * if (RemoteData.is.loading(data)) {
		 *   console.log("Data is loading");
		 * }
		 * ```
		 */
		loading: isLoading,

		/**
		 * Type guard that checks if a RemoteData is Failure.
		 *
		 * @example
		 * ```ts
		 * const data = RemoteData.make.failure("Failed");
		 * if (RemoteData.is.failure(data)) {
		 *   console.log(data.error); // "Failed"
		 * }
		 * ```
		 */
		failure: isFailure,

		/**
		 * Type guard that checks if a RemoteData is Success.
		 *
		 * @example
		 * ```ts
		 * const data = RemoteData.make.success(42);
		 * if (RemoteData.is.success(data)) {
		 *   console.log(data.value); // 42
		 * }
		 * ```
		 */
		success: isSuccess,
	},

	/**
	 * Transforms the success value inside a RemoteData.
	 *
	 * @example
	 * ```ts
	 * pipe(RemoteData.make.success(5), RemoteData.map(n => n * 2)); // Success(10)
	 * pipe(RemoteData.make.loading(), RemoteData.map(n => n * 2)); // Loading
	 * ```
	 */
	map: <A, B>(f: (a: A) => B) => <E>(data: RemoteData<E, A>): RemoteData<E, B> =>
		isSuccess(data) ? makeSuccess(f(data.value)) : (data as RemoteData<E, B>),

	/**
	 * Transforms the error value inside a RemoteData.
	 *
	 * @example
	 * ```ts
	 * pipe(RemoteData.make.failure("oops"), RemoteData.mapError(e => e.toUpperCase())); // Failure("OOPS")
	 * ```
	 */
	mapError: <E, F>(f: (e: E) => F) => <A>(data: RemoteData<E, A>): RemoteData<F, A> =>
		isFailure(data) ? makeFailure(f(data.error)) : (data as RemoteData<F, A>),

	/**
	 * Chains RemoteData computations. If the input is Success, passes the value to f.
	 * Otherwise, propagates the current state.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   RemoteData.make.success(5),
	 *   RemoteData.chain(n => n > 0 ? RemoteData.make.success(n) : RemoteData.make.failure("negative"))
	 * );
	 * ```
	 */
	chain: <E2, A, B>(f: (a: A) => RemoteData<E2, B>) => <E1 = never>(data: RemoteData<E1, A>): RemoteData<E1 | E2, B> =>
		isSuccess(data) ? f(data.value) : (data as RemoteData<E1 | E2, B>),

	/**
	 * Applies a function wrapped in a RemoteData to a value wrapped in a RemoteData.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   RemoteData.make.success(add),
	 *   RemoteData.ap(RemoteData.make.success(5)),
	 *   RemoteData.ap(RemoteData.make.success(3))
	 * ); // Success(8)
	 * ```
	 */
	ap: <E, A>(arg: RemoteData<E, A>) => <B>(data: RemoteData<E, (a: A) => B>): RemoteData<E, B> => {
		if (isSuccess(data) && isSuccess(arg)) {
			return makeSuccess(data.value(arg.value));
		}
		if (isFailure(data)) { return data; }
		if (isFailure(arg)) { return arg; }
		if (isLoading(data) || isLoading(arg)) { return makeLoading(); }
		return makeNotAsked();
	},

	/**
	 * Extracts the value from a RemoteData by providing handlers for all four cases.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   userData,
	 *   RemoteData.fold(
	 *     e => `Error: ${e}`,
	 *     () => "Not asked",
	 *     () => "Loading...",
	 *     value => `Got: ${value}`
	 *   )
	 * );
	 * ```
	 */
	fold:
		<E, A, B>(onFailure: (e: E) => B, onNotAsked: () => B, onLoading: () => B, onSuccess: (a: A) => B) =>
		(data: RemoteData<E, A>): B => {
			switch (data.kind) {
				case "Failure": {
					return onFailure(data.error);
				}
				case "NotAsked": {
					return onNotAsked();
				}
				case "Loading": {
					return onLoading();
				}
				case "Success": {
					return onSuccess(data.value);
				}
			}
		},

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
	match:
		<E, A, B>(cases: { notAsked: () => B; loading: () => B; failure: (e: E) => B; success: (a: A) => B; }) =>
		(data: RemoteData<E, A>): B => {
			switch (data.kind) {
				case "NotAsked": {
					return cases.notAsked();
				}
				case "Loading": {
					return cases.loading();
				}
				case "Failure": {
					return cases.failure(data.error);
				}
				case "Success": {
					return cases.success(data.value);
				}
			}
		},

	/**
	 * Returns the success value or a default value if the RemoteData is not Success.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @example
	 * ```ts
	 * pipe(RemoteData.make.success(5), RemoteData.getOrElse(() => 0)); // 5
	 * pipe(RemoteData.make.loading(), RemoteData.getOrElse(() => 0)); // 0
	 * pipe(RemoteData.make.loading<string, number>(), RemoteData.getOrElse(() => null)); // null — typed as number | null
	 * ```
	 */
	getOrElse: <B>(defaultValue: () => B) => <E, A>(data: RemoteData<E, A>): A | B =>
		isSuccess(data) ? data.value : defaultValue(),

	/**
	 * Executes a side effect on the success value without changing the RemoteData.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   RemoteData.make.success(5),
	 *   RemoteData.tap(n => console.log("Value:", n)),
	 *   RemoteData.map(n => n * 2)
	 * );
	 * ```
	 */
	tap: <E, A>(f: (a: A) => void) => (data: RemoteData<E, A>): RemoteData<E, A> => {
		if (isSuccess(data)) { f(data.value); }
		return data;
	},

	/**
	 * Executes a side effect on the failure error without changing the RemoteData.
	 * Useful for logging errors.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   RemoteData.make.failure("not found"),
	 *   RemoteData.tapError(e => console.error("fetch failed:", e)),
	 *   RemoteData.map(render)
	 * );
	 * ```
	 */
	tapError: <E, A>(f: (e: E) => void) => (data: RemoteData<E, A>): RemoteData<E, A> => {
		if (isFailure(data)) { f(data.error); }
		return data;
	},

	/**
	 * Recovers from a Failure state by providing a fallback RemoteData.
	 * The fallback can produce a different success type, widening the result to `RemoteData<E, A | B>`.
	 */
	recover: <E, B>(fallback: (e: E) => RemoteData<E, B>) => <A>(data: RemoteData<E, A>): RemoteData<E, A | B> =>
		isFailure(data) ? fallback(data.error) : data,

	// --- to ---
	to: {
		/**
		 * Converts a RemoteData to a Maybe.
		 * Success becomes Some, all other states become None.
		 */
		Maybe: <E, A>(data: RemoteData<E, A>): Maybe<A> =>
			isSuccess(data) ? CoreMaybe.make.some(data.value) : CoreMaybe.make.none(),

		/**
		 * Converts a RemoteData to a Result.
		 * Success becomes Ok, Failure becomes Err.
		 * NotAsked and Loading become Err with the provided fallback error.
		 *
		 * @example
		 * ```ts
		 * pipe(
		 *   RemoteData.make.success(42),
		 *   RemoteData.to.Result(() => "not loaded")
		 * ); // Ok(42)
		 * ```
		 */
		Result: <E>(onNotReady: () => E) => <A>(data: RemoteData<E, A>): Result<E, A> =>
			isSuccess(data) ? CoreResult.make.ok(data.value) : CoreResult.make.err(isFailure(data) ? data.error : onNotReady()),
	},

	// --- from ---
	from: {
		/**
		 * Converts a Result to a RemoteData.
		 * Ok becomes Success, Err becomes Failure.
		 *
		 * @example
		 * ```ts
		 * const result = await Task.Result.tryCatch(() => loadUser(), { onError: String })();
		 * setState(RemoteData.from.Result(result)); // Success(user) or Failure(msg)
		 * ```
		 */
		Result: <E, A>(data: Result<E, A>): RemoteData<E, A> =>
			CoreResult.is.ok(data) ? makeSuccess(data.value) : makeFailure(data.error),

		/**
		 * Converts a Maybe to a RemoteData.
		 * Some becomes Success, None becomes Failure using the onNone error producer.
		 *
		 * @example
		 * ```ts
		 * pipe(Maybe.make.some(user), RemoteData.from.Maybe(() => "not found")); // Success(user)
		 * pipe(Maybe.make.none(), RemoteData.from.Maybe(() => "not found"));     // Failure("not found")
		 * ```
		 */
		Maybe: <E>(onNone: () => E) => <A>(data: Maybe<A>): RemoteData<E, A> =>
			CoreMaybe.is.some(data) ? makeSuccess(data.value) : makeFailure(onNone()),
	},

	/**
	 * Filters a `Success` value. When the predicate passes, the value is kept. When it fails,
	 * `Success` becomes `Failure` using the error produced by `onFalse`. All other states pass through unchanged.
	 *
	 * @example
	 * ```ts
	 * RemoteData.filter(n => n > 0, n => `${n} is not a valid price`)(RemoteData.make.success(9.99));
	 * // Success(9.99)
	 * RemoteData.filter(n => n > 0, n => `${n} is not a valid price`)(RemoteData.make.success(-1));
	 * // Failure("-1 is not a valid price")
	 * RemoteData.filter(n => n > 0, () => "error")(RemoteData.make.loading()); // Loading
	 * ```
	 */
	filter: <E, A>(pred: (a: A) => boolean, onFalse: (a: A) => E) => (data: RemoteData<E, A>): RemoteData<E, A> =>
		isSuccess(data) ? (pred(data.value) ? data : makeFailure(onFalse(data.value))) : data,
};
