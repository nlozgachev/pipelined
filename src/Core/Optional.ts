import type { Lens } from "./Lens.ts";
import { Maybe } from "./Maybe.ts";

/** Keys of T for which undefined is assignable (i.e. optional fields). */
type OptionalKeys<T> = {
	[K in keyof T]-?: undefined extends T[K] ? K : never;
}[keyof T];

/**
 * Optional<S, A> focuses on a value A inside a structure S that may or may
 * not be present. Like a Lens, but get returns Maybe<A>.
 *
 * Compose with other Optionals via `andThen`, or with a Lens via `andThenLens`.
 * Convert a Lens to an Optional with `Lens.toOptional`.
 *
 * @example
 * ```ts
 * type Profile = { username: string; bio?: string };
 *
 * const bioOpt = Optional.prop<Profile>()("bio");
 *
 * pipe(profile, Optional.get(bioOpt));               // Some("hello") or None
 * pipe(profile, Optional.set(bioOpt)("hello"));      // new Profile with bio set
 * pipe(profile, Optional.modify(bioOpt)(s => s + "!")); // appends if present
 * ```
 */
export type Optional<S, A> = {
	readonly get: (s: S) => Maybe<A>;
	readonly set: (a: A) => (s: S) => S;
};

export namespace Optional {
	/**
	 * Constructs an Optional from a getter (returning Maybe<A>) and a setter.
	 *
	 * @example
	 * ```ts
	 * const firstChar = Optional.make(
	 *   (s: string) => s.length > 0 ? Maybe.some(s[0]) : Maybe.none(),
	 *   (c) => (s) => s.length > 0 ? c + s.slice(1) : s,
	 * );
	 * ```
	 */
	export const make = <S, A>(
		get: (s: S) => Maybe<A>,
		set: (a: A) => (s: S) => S,
	): Optional<S, A> => ({ get, set });

	/**
	 * Creates an Optional that focuses on an optional property of an object.
	 * Only keys whose type includes undefined (i.e. `field?: T`) are accepted.
	 * Call with the structure type first, then the key.
	 *
	 * @example
	 * ```ts
	 * type Profile = { username: string; bio?: string };
	 * const bioOpt = Optional.prop<Profile>()("bio");
	 * ```
	 */
	export const prop = <S>() => <K extends OptionalKeys<S>>(key: K): Optional<S, NonNullable<S[K]>> =>
		make(
			(s) => {
				const val = s[key];
				return val !== null && val !== undefined ? Maybe.some(val as NonNullable<S[K]>) : Maybe.none();
			},
			(a) => (s) => ({ ...s, [key]: a } as S),
		);

	/**
	 * Creates an Optional that focuses on an element at a given index in an array.
	 * Returns None when the index is out of bounds; set is a no-op when out of bounds.
	 *
	 * @example
	 * ```ts
	 * const firstItem = Optional.index<string>(0);
	 *
	 * pipe(["a", "b"], Optional.get(firstItem)); // Some("a")
	 * pipe([], Optional.get(firstItem));         // None
	 * ```
	 */
	export const index = <A>(i: number): Optional<A[], A> =>
		make(
			(arr) => i >= 0 && i < arr.length ? Maybe.some(arr[i]) : Maybe.none(),
			(a) => (arr) => {
				if (i < 0 || i >= arr.length) return arr;
				const copy = [...arr];
				copy[i] = a;
				return copy;
			},
		);

	/**
	 * Reads the focused value from a structure, returning Maybe<A>.
	 *
	 * @example
	 * ```ts
	 * pipe(profile, Optional.get(bioOpt)); // Some("...") or None
	 * ```
	 */
	export const get = <S, A>(opt: Optional<S, A>) => (s: S): Maybe<A> => opt.get(s);

	/**
	 * Replaces the focused value within a structure.
	 * For indexed focuses, this is a no-op when the index is out of bounds.
	 *
	 * @example
	 * ```ts
	 * pipe(profile, Optional.set(bioOpt)("hello"));
	 * ```
	 */
	export const set = <S, A>(opt: Optional<S, A>) => (a: A) => (s: S): S => opt.set(a)(s);

	/**
	 * Applies a function to the focused value if it is present; returns the
	 * structure unchanged if the focus is absent.
	 *
	 * @example
	 * ```ts
	 * pipe(profile, Optional.modify(bioOpt)(s => s.toUpperCase()));
	 * ```
	 */
	export const modify = <S, A>(opt: Optional<S, A>) => (f: (a: A) => A) => (s: S): S => {
		const val = opt.get(s);
		return val.kind === "None" ? s : opt.set(f(val.value))(s);
	};

	/**
	 * Returns the focused value or a default when the focus is absent.
	 *
	 * @example
	 * ```ts
	 * pipe(profile, Optional.getOrElse(bioOpt)(() => "no bio"));
	 * ```
	 */
	export const getOrElse = <S, A>(opt: Optional<S, A>) => (defaultValue: () => A) => (s: S): A => {
		const val = opt.get(s);
		return val.kind === "Some" ? val.value : defaultValue();
	};

	/**
	 * Extracts a value from an Optional focus using handlers for the present
	 * and absent cases.
	 *
	 * @example
	 * ```ts
	 * pipe(profile, Optional.fold(bioOpt)(() => "no bio", (bio) => bio.toUpperCase()));
	 * ```
	 */
	export const fold = <S, A>(opt: Optional<S, A>) => <B>(onNone: () => B, onSome: (a: A) => B) => (s: S): B => {
		const val = opt.get(s);
		return val.kind === "Some" ? onSome(val.value) : onNone();
	};

	/**
	 * Pattern matches on an Optional focus using a named-case object.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   profile,
	 *   Optional.match(bioOpt)({ none: () => "no bio", some: (bio) => bio }),
	 * );
	 * ```
	 */
	export const match = <S, A>(opt: Optional<S, A>) =>
	<B>(cases: { none: () => B; some: (a: A) => B; }) =>
	(
		s: S,
	): B => {
		const val = opt.get(s);
		return val.kind === "Some" ? cases.some(val.value) : cases.none();
	};

	/**
	 * Composes two Optionals: focuses through the outer, then through the inner.
	 * Returns None if either focus is absent.
	 *
	 * @example
	 * ```ts
	 * const deepOpt = pipe(
	 *   Optional.prop<User>()("address"),
	 *   Optional.andThen(Optional.prop<Address>()("landmark")),
	 * );
	 * ```
	 */
	export const andThen = <A, B>(inner: Optional<A, B>) => <S>(outer: Optional<S, A>): Optional<S, B> =>
		make(
			(s) => {
				const mid = outer.get(s);
				return mid.kind === "None" ? Maybe.none() : inner.get(mid.value);
			},
			(b) => (s) => {
				const mid = outer.get(s);
				return mid.kind === "None" ? s : outer.set(inner.set(b)(mid.value))(s);
			},
		);

	/**
	 * Composes an Optional with a Lens, producing an Optional.
	 * The Lens focuses within the value found by the Optional.
	 *
	 * @example
	 * ```ts
	 * const cityOpt = pipe(
	 *   Optional.prop<User>()("address"),
	 *   Optional.andThenLens(Lens.prop<Address>()("city")),
	 * );
	 * ```
	 */
	export const andThenLens = <A, B>(inner: Lens<A, B>) => <S>(outer: Optional<S, A>): Optional<S, B> =>
		make(
			(s) => {
				const mid = outer.get(s);
				return mid.kind === "None" ? Maybe.none() : Maybe.some(inner.get(mid.value));
			},
			(b) => (s) => {
				const mid = outer.get(s);
				return mid.kind === "None" ? s : outer.set(inner.set(b)(mid.value))(s);
			},
		);
}
