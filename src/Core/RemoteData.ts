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
export type RemoteData<E, A> = RemoteData.NotAsked | RemoteData.Loading | RemoteData.Failure<E> | RemoteData.Success<A>;

export namespace RemoteData {
	export type NotAsked = WithKind<"NotAsked">;
	export type Loading = WithKind<"Loading">;
	export type Failure<E> = WithKind<"Failure"> & WithError<E>;
	export type Success<A> = WithKind<"Success"> & WithValue<A>;
}

// =============================================================================
// Private Helpers & Variant Constructors
// =============================================================================
const _notAsked: RemoteData.NotAsked = { kind: "NotAsked" };
const _loading: RemoteData.Loading = { kind: "Loading" };

const makeNotAsked = (): RemoteData.NotAsked => _notAsked;
const makeLoading = (): RemoteData.Loading => _loading;
const makeFailure = <E>(error: E): RemoteData.Failure<E> => ({ kind: "Failure", error });
const makeSuccess = <A>(value: A): RemoteData.Success<A> => ({ kind: "Success", value });

const isNotAsked = <E, A>(remoteData: RemoteData<E, A>): remoteData is RemoteData.NotAsked =>
	remoteData.kind === "NotAsked";
const isLoading = <E, A>(remoteData: RemoteData<E, A>): remoteData is RemoteData.Loading =>
	remoteData.kind === "Loading";
const isFailure = <E, A>(remoteData: RemoteData<E, A>): remoteData is RemoteData.Failure<E> =>
	remoteData.kind === "Failure";
const isSuccess = <E, A>(remoteData: RemoteData<E, A>): remoteData is RemoteData.Success<A> =>
	remoteData.kind === "Success";

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
		 * @see {@link RemoteData.is.success} to check if data loaded successfully.
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
		 * @see {@link RemoteData.is.failure} to check if data loading failed.
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
	 * @see {@link RemoteData.chain} to sequence operations that themselves return a RemoteData.
	 * @see {@link RemoteData.mapError} to transform the error value instead of the success value.
	 *
	 * @example
	 * ```ts
	 * pipe(RemoteData.make.success(5), RemoteData.map(n => n * 2)); // Success(10)
	 * pipe(RemoteData.make.loading(), RemoteData.map(n => n * 2)); // Loading
	 * ```
	 */
	map: <A, B>(transform: (value: A) => B) => <E>(remoteData: RemoteData<E, A>): RemoteData<E, B> =>
		isSuccess(remoteData) ? makeSuccess(transform(remoteData.value)) : (remoteData as RemoteData<E, B>),

	/**
	 * Transforms the error value inside a RemoteData.
	 *
	 * @see {@link RemoteData.map} to transform the success value instead of the error value.
	 *
	 * @example
	 * ```ts
	 * pipe(RemoteData.make.failure("oops"), RemoteData.mapError(e => e.toUpperCase())); // Failure("OOPS")
	 * ```
	 */
	mapError: <E, F>(transform: (error: E) => F) => <A>(remoteData: RemoteData<E, A>): RemoteData<F, A> =>
		isFailure(remoteData) ? makeFailure(transform(remoteData.error)) : (remoteData as RemoteData<F, A>),

	/**
	 * Chains RemoteData computations. If the input is Success, passes the value to transform.
	 * Otherwise, propagates the current state.
	 *
	 * @see {@link RemoteData.map} to transform the success value without returning a new RemoteData.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   RemoteData.make.success(5),
	 *   RemoteData.chain(n => n > 0 ? RemoteData.make.success(n) : RemoteData.make.failure("negative"))
	 * );
	 * ```
	 */
	chain:
		<E2, A, B>(transform: (value: A) => RemoteData<E2, B>) =>
		<E1 = never>(remoteData: RemoteData<E1, A>): RemoteData<E1 | E2, B> =>
			isSuccess(remoteData) ? transform(remoteData.value) : (remoteData as RemoteData<E1 | E2, B>),

	/**
	 * Applies a function wrapped in a RemoteData to a value wrapped in a RemoteData.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   RemoteData.make.success(add),
	 *   RemoteData.apply(RemoteData.make.success(5)),
	 *   RemoteData.apply(RemoteData.make.success(3))
	 * ); // Success(8)
	 * ```
	 */
	apply:
		<E2, A>(arg: RemoteData<E2, A>) => <E1, B>(remoteData: RemoteData<E1, (value: A) => B>): RemoteData<E1 | E2, B> => {
			if (isSuccess(remoteData) && isSuccess(arg)) {
				return makeSuccess(remoteData.value(arg.value));
			}
			if (isFailure(remoteData)) { return remoteData; }
			if (isFailure(arg)) { return arg; }
			if (isLoading(remoteData) || isLoading(arg)) { return makeLoading(); }
			return makeNotAsked();
		},

	/**
	 * Extracts the value from a RemoteData by providing handlers for all four cases.
	 *
	 * @see {@link RemoteData.match} for named-case pattern matching with an object literal.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   userData,
	 *   RemoteData.fold(
	 *     error => `Error: ${error}`,
	 *     () => "Not asked",
	 *     () => "Loading...",
	 *     value => `Got: ${value}`
	 *   )
	 * );
	 * ```
	 */
	fold:
		<E, A, B>(onFailure: (error: E) => B, onNotAsked: () => B, onLoading: () => B, onSuccess: (value: A) => B) =>
		(remoteData: RemoteData<E, A>): B => {
			switch (remoteData.kind) {
				case "Failure": {
					return onFailure(remoteData.error);
				}
				case "NotAsked": {
					return onNotAsked();
				}
				case "Loading": {
					return onLoading();
				}
				case "Success": {
					return onSuccess(remoteData.value);
				}
			}
		},

	/**
	 * Pattern matches on a RemoteData, returning the result of the matching case.
	 *
	 * @see {@link RemoteData.fold} for positional argument pattern matching.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   userData,
	 *   RemoteData.match({
	 *     notAsked: () => "Click to load",
	 *     loading: () => "Loading...",
	 *     failure: error => `Error: ${error}`,
	 *     success: user => `Hello, ${user.name}!`
	 *   })
	 * );
	 * ```
	 */
	match:
		<E, A, B>(cases: { notAsked: () => B; loading: () => B; failure: (error: E) => B; success: (value: A) => B; }) =>
		(remoteData: RemoteData<E, A>): B => {
			switch (remoteData.kind) {
				case "NotAsked": {
					return cases.notAsked();
				}
				case "Loading": {
					return cases.loading();
				}
				case "Failure": {
					return cases.failure(remoteData.error);
				}
				case "Success": {
					return cases.success(remoteData.value);
				}
			}
		},

	/**
	 * Returns the success value or a default value if the RemoteData is not Success.
	 * The default can be a different type, widening the result to `A | B`.
	 *
	 * @see {@link RemoteData.fold} to handle all four lifecycle states.
	 *
	 * @example
	 * ```ts
	 * pipe(RemoteData.make.success(5), RemoteData.getOrElse(() => 0)); // 5
	 * pipe(RemoteData.make.loading(), RemoteData.getOrElse(() => 0)); // 0
	 * pipe(RemoteData.make.loading<string, number>(), RemoteData.getOrElse(() => null)); // null — typed as number | null
	 * ```
	 */
	getOrElse: <B>(fallback: () => B) => <E, A>(remoteData: RemoteData<E, A>): A | B =>
		isSuccess(remoteData) ? remoteData.value : fallback(),

	/**
	 * Executes a side effect on the success value without changing the RemoteData.
	 *
	 * @see {@link RemoteData.tapError} to perform a side effect on the failure error.
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
	tap: <E, A>(sideEffect: (value: A) => void) => (remoteData: RemoteData<E, A>): RemoteData<E, A> => {
		if (isSuccess(remoteData)) { sideEffect(remoteData.value); }
		return remoteData;
	},

	/**
	 * Executes a side effect on the failure error without changing the RemoteData.
	 * Useful for logging errors.
	 *
	 * @see {@link RemoteData.tap} to perform a side effect on the success value.
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
	tapError: <E, A>(sideEffect: (error: E) => void) => (remoteData: RemoteData<E, A>): RemoteData<E, A> => {
		if (isFailure(remoteData)) { sideEffect(remoteData.error); }
		return remoteData;
	},

	/**
	 * Recovers from a Failure state by providing a fallback RemoteData.
	 * The fallback can produce a different success type or resolve with a different error type.
	 */
	recover:
		<E1, E2, B>(fallback: (error: E1) => RemoteData<E2, B>) =>
		<A>(remoteData: RemoteData<E1, A>): RemoteData<E2, A | B> =>
			isFailure(remoteData) ? fallback(remoteData.error) : (remoteData as unknown as RemoteData<E2, A | B>),

	// --- to ---
	to: {
		/**
		 * Converts a RemoteData to a Maybe.
		 * Success becomes Some, all other states become None.
		 */
		Maybe: <E, A>(remoteData: RemoteData<E, A>): Maybe<A> =>
			isSuccess(remoteData) ? CoreMaybe.make.some(remoteData.value) : CoreMaybe.make.none(),

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
		Result: <E>(onNotReady: () => E) => <A>(remoteData: RemoteData<E, A>): Result<E, A> =>
			isSuccess(remoteData)
				? CoreResult.make.ok(remoteData.value)
				: CoreResult.make.err(isFailure(remoteData) ? remoteData.error : onNotReady()),
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
		Result: <E, A>(result: Result<E, A>): RemoteData<E, A> =>
			CoreResult.is.ok(result) ? makeSuccess(result.value) : makeFailure(result.error),

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
		Maybe: <E>(onNone: () => E) => <A>(maybe: Maybe<A>): RemoteData<E, A> =>
			CoreMaybe.is.some(maybe) ? makeSuccess(maybe.value) : makeFailure(onNone()),
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
	filter:
		<E, A>(predicate: (value: A) => boolean, onFalse: (value: A) => E) =>
		(remoteData: RemoteData<E, A>): RemoteData<E, A> =>
			isSuccess(remoteData)
				? (predicate(remoteData.value) ? remoteData : makeFailure(onFalse(remoteData.value)))
				: remoteData,
};
