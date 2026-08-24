// =============================================================================
// Imports
// =============================================================================
import { Maybe, Result } from "#core";

// =============================================================================
// Types
// =============================================================================
export type BoolMatchCases<A, B> = { readonly true: () => A; readonly false: () => B; };

// =============================================================================
// Private Helpers & Combinator Implementations
// =============================================================================
const isBoolean = (u: unknown): u is boolean => typeof u === "boolean";
const isTrue = (u: unknown): u is true => u === true;
const isFalse = (u: unknown): u is false => u === false;
const isTruthy = <T>(u: T): u is Exclude<T, false | 0 | 0n | "" | null | undefined> => Boolean(u);
const isFalsy = (u: unknown): u is false | 0 | 0n | "" | null | undefined => !u;

const not = (b: boolean): boolean => !b;
const and = (that: boolean) => (self: boolean): boolean => self && that;
const or = (that: boolean) => (self: boolean): boolean => self || that;
const xor = (that: boolean) => (self: boolean): boolean => self !== that;

const andLazy = (that: () => boolean) => (self: boolean): boolean => self && that();
const orLazy = (that: () => boolean) => (self: boolean): boolean => self || that();

const all = (booleans: readonly boolean[]): boolean => {
	for (let i = 0; i < booleans.length; i++) {
		if (!booleans[i]) {
			return false;
		}
	}
	return true;
};

const any = (booleans: readonly boolean[]): boolean => {
	for (let i = 0; i < booleans.length; i++) {
		if (booleans[i]) {
			return true;
		}
	}
	return false;
};

const fold = <A, B>(onFalse: () => A, onTrue: () => B) => (b: boolean): A | B => (b ? onTrue() : onFalse());

const match = <A, B>(cases: BoolMatchCases<A, B>) => (b: boolean): A | B => (b ? cases.true() : cases.false());

const fromString = (s: string): Maybe<boolean> => {
	const trimmed = s.trim().toLowerCase();
	if (trimmed === "true") {
		return Maybe.make.some(true);
	}
	if (trimmed === "false") {
		return Maybe.make.some(false);
	}
	return Maybe.make.none();
};

const fromNumber = (n: number): Maybe<boolean> => {
	if (n === 1) {
		return Maybe.make.some(true);
	}
	if (n === 0) {
		return Maybe.make.some(false);
	}
	return Maybe.make.none();
};

const fromTruthy = (value: unknown): boolean => Boolean(value);

const toMaybe = <A>(onTrue: () => A) => (b: boolean): Maybe<A> => (b ? Maybe.make.some(onTrue()) : Maybe.make.none());

const toResult = <E, A>(onErr: () => E, onOk: () => A) => (b: boolean): Result<E, A> =>
	b ? Result.make.ok(onOk()) : Result.make.err(onErr());

const toNumber = (b: boolean): 1 | 0 => (b ? 1 : 0);

const toString = (b: boolean): "true" | "false" => (b ? "true" : "false");

// =============================================================================
// Public Export
// =============================================================================
export const Bool = {
	is: {
		/**
		 * Type guard — checks if a value is a primitive boolean.
		 *
		 * @example
		 * ```ts
		 * Bool.is.boolean(true);      // true
		 * Bool.is.boolean(false);     // true
		 * Bool.is.boolean("true");    // false
		 * Bool.is.boolean(null);      // false
		 * ```
		 */
		boolean: isBoolean,

		/**
		 * Narrowing guard — checks if a value is strictly `true`.
		 *
		 * @example
		 * ```ts
		 * Bool.is.true(true);  // true
		 * Bool.is.true(false); // false
		 * ```
		 */
		true: isTrue,

		/**
		 * Narrowing guard — checks if a value is strictly `false`.
		 *
		 * @example
		 * ```ts
		 * Bool.is.false(false); // true
		 * Bool.is.false(true);  // false
		 * ```
		 */
		false: isFalse,

		/**
		 * Type guard — checks if a value is truthy (not `false`, `0`, `0n`, `""`, `null`, `undefined`, or `NaN`).
		 *
		 * @example
		 * ```ts
		 * Bool.is.truthy("hello"); // true
		 * Bool.is.truthy(42);      // true
		 * Bool.is.truthy(0);       // false
		 * Bool.is.truthy(null);    // false
		 * ```
		 */
		truthy: isTruthy,

		/**
		 * Type guard — checks if a value is falsy (`false`, `0`, `0n`, `""`, `null`, `undefined`, or `NaN`).
		 *
		 * @example
		 * ```ts
		 * Bool.is.falsy("");        // true
		 * Bool.is.falsy(null);      // true
		 * Bool.is.falsy("content"); // false
		 * ```
		 */
		falsy: isFalsy,
	},

	/**
	 * Unary boolean negation: inverts the given boolean value.
	 *
	 * @example
	 * ```ts
	 * Bool.not(true);  // false
	 * Bool.not(false); // true
	 * ```
	 */
	not,

	/**
	 * Logical AND combinator. Returns `true` only if both `self` and `that` are `true`.
	 *
	 * Data-last: `pipe(self, Bool.and(that))`.
	 *
	 * @example
	 * ```ts
	 * pipe(true, Bool.and(true));  // true
	 * pipe(true, Bool.and(false)); // false
	 * ```
	 */
	and,

	/**
	 * Logical OR combinator. Returns `true` if either `self` or `that` is `true`.
	 *
	 * Data-last: `pipe(self, Bool.or(that))`.
	 *
	 * @example
	 * ```ts
	 * pipe(false, Bool.or(true));  // true
	 * pipe(false, Bool.or(false)); // false
	 * ```
	 */
	or,

	/**
	 * Logical XOR (exclusive OR) combinator. Returns `true` if exactly one of `self` and `that` is `true`.
	 *
	 * Data-last: `pipe(self, Bool.xor(that))`.
	 *
	 * @example
	 * ```ts
	 * pipe(true, Bool.xor(false)); // true
	 * pipe(true, Bool.xor(true));  // false
	 * ```
	 */
	xor,

	/**
	 * Lazy logical AND combinator.
	 * If `self` is `false`, the `that` computation is never evaluated.
	 *
	 * Data-last: `pipe(self, Bool.andLazy(that))`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   isCached,
	 *   Bool.andLazy(() => checkPermissions())
	 * );
	 * ```
	 */
	andLazy,

	/**
	 * Lazy logical OR combinator.
	 * If `self` is `true`, the `that` computation is never evaluated.
	 *
	 * Data-last: `pipe(self, Bool.orLazy(that))`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   isAdmin,
	 *   Bool.orLazy(() => hasAccess(userId))
	 * );
	 * ```
	 */
	orLazy,

	/**
	 * N-ary AND aggregation across an array of booleans.
	 * Returns `true` if every boolean is `true`, or for an empty array (vacuous truth).
	 * Short-circuits on the first `false`.
	 *
	 * @example
	 * ```ts
	 * Bool.all([true, true, true]);  // true
	 * Bool.all([true, false, true]); // false
	 * Bool.all([]);                  // true
	 * ```
	 */
	all,

	/**
	 * N-ary OR aggregation across an array of booleans.
	 * Returns `true` if at least one boolean is `true`. Returns `false` for an empty array.
	 * Short-circuits on the first `true`.
	 *
	 * @example
	 * ```ts
	 * Bool.any([false, true, false]); // true
	 * Bool.any([false, false]);       // false
	 * Bool.any([]);                   // false
	 * ```
	 */
	any,

	/**
	 * Catamorphism for boolean: evaluates `onFalse()` when `false` and `onTrue()` when `true`.
	 *
	 * Positional ordering: `onFalse` first, `onTrue` second.
	 * Aligned with `Result.fold(onErr, onOk)` and `Maybe.fold(onNone, onSome)`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   isDarkMode,
	 *   Bool.fold(
	 *     () => "light-theme",
	 *     () => "dark-theme"
	 *   )
	 * );
	 * ```
	 */
	fold,

	/**
	 * Pattern matching on boolean using named cases `{ true, false }`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   isEnabled,
	 *   Bool.match({
	 *     true: () => "Feature Active",
	 *     false: () => "Feature Disabled",
	 *   })
	 * );
	 * ```
	 */
	match,

	// --- from ---
	from: {
		/**
		 * Parses a string into a `Maybe<boolean>`.
		 * Returns `Some(true)` for `"true"`, `Some(false)` for `"false"` (case-insensitive & trimmed),
		 * and `None` for any other string.
		 *
		 * @example
		 * ```ts
		 * Bool.from.string("true");  // Some(true)
		 * Bool.from.string("FALSE"); // Some(false)
		 * Bool.from.string("yes");   // None
		 * ```
		 */
		string: fromString,

		/**
		 * Converts a number into a `Maybe<boolean>`.
		 * Returns `Some(true)` for `1`, `Some(false)` for `0`, and `None` for any other number.
		 *
		 * @example
		 * ```ts
		 * Bool.from.number(1);  // Some(true)
		 * Bool.from.number(0);  // Some(false)
		 * Bool.from.number(42); // None
		 * ```
		 */
		number: fromNumber,

		/**
		 * Coerces any unknown value into a boolean via standard JS `Boolean(value)`.
		 *
		 * @example
		 * ```ts
		 * Bool.from.truthy("hello"); // true
		 * Bool.from.truthy(0);       // false
		 * ```
		 */
		truthy: fromTruthy,
	},

	// --- to ---
	to: {
		/**
		 * Lifts a boolean condition into a `Maybe`.
		 * Returns `Some(onTrue())` when `true`, and `None` when `false`.
		 *
		 * @example
		 * ```ts
		 * pipe(
		 *   user.isVerified,
		 *   Bool.to.Maybe(() => user.profile)
		 * ); // Some(profile) or None
		 * ```
		 */
		Maybe: toMaybe,

		/**
		 * Lifts a boolean condition into a `Result`.
		 * Returns `Ok(onOk())` when `true`, and `Err(onErr())` when `false`.
		 *
		 * @example
		 * ```ts
		 * pipe(
		 *   hasPermission,
		 *   Bool.to.Result(
		 *     () => "Permission denied",
		 *     () => sessionData
		 *   )
		 * ); // Ok(sessionData) or Err("Permission denied")
		 * ```
		 */
		Result: toResult,

		/**
		 * Converts a boolean to numeric `1` or `0`.
		 *
		 * @example
		 * ```ts
		 * Bool.to.number(true);  // 1
		 * Bool.to.number(false); // 0
		 * ```
		 */
		number: toNumber,

		/**
		 * Converts a boolean to literal string `"true"` or `"false"`.
		 *
		 * @example
		 * ```ts
		 * Bool.to.string(true);  // "true"
		 * Bool.to.string(false); // "false"
		 * ```
		 */
		string: toString,
	},
};
