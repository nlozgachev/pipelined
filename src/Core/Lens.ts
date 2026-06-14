import type { Optional } from "#core";

/**
 * Lens<S, A> focuses on a single value A inside a structure S, providing
 * a composable way to read and immutably update nested data.
 *
 * A Lens always succeeds: the focused value is guaranteed to exist.
 * For optional or indexed focuses, use Optional<S, A>.
 *
 * @example
 * ```ts
 * type Address = { city: string; zip: string };
 * type User = { name: string; address: Address };
 *
 * const addressLens = Lens.from.property<User>()("address");
 * const cityLens    = Lens.from.property<Address>()("city");
 * const userCityLens = pipe(addressLens, Lens.andThen(cityLens));
 *
 * pipe(user, Lens.get(userCityLens));             // "Berlin"
 * pipe(user, Lens.set(userCityLens)("Hamburg"));  // new User with city updated
 * pipe(user, Lens.modify(userCityLens)(c => c.toUpperCase())); // "BERLIN"
 * ```
 */
export type Lens<S, A> = { readonly get: (s: S) => A; readonly set: (a: A) => (s: S) => S; };

export namespace Lens {
	// --- from ---
	export namespace from {
		/**
		 * Constructs a Lens from a getter and a setter.
		 *
		 * @example
		 * ```ts
		 * const nameLens = Lens.from.accessors(
		 *   (user: User) => user.name,
		 *   (name) => (user) => ({ ...user, name }),
		 * );
		 * ```
		 */
		export const accessors = <S, A>(get: (s: S) => A, set: (a: A) => (s: S) => S): Lens<S, A> => ({ get, set });

		/**
		 * Creates a Lens that focuses on a property of an object.
		 * Call with the structure type first, then the key.
		 *
		 * @example
		 * ```ts
		 * const nameLens = Lens.from.property<User>()("name");
		 * ```
		 */
		export const property = <S>() => <K extends keyof S>(key: K): Lens<S, S[K]> =>
			accessors((s) => s[key], (a) => (s) => ({ ...s, [key]: a } as S));
	}

	/**
	 * Reads the focused value from a structure.
	 *
	 * @example
	 * ```ts
	 * pipe(user, Lens.get(nameLens)); // "Alice"
	 * ```
	 */
	export const get = <S, A>(lens: Lens<S, A>) => (s: S): A => lens.get(s);

	/**
	 * Replaces the focused value within a structure, returning a new structure.
	 *
	 * @example
	 * ```ts
	 * pipe(user, Lens.set(nameLens)("Bob")); // new User with name "Bob"
	 * ```
	 */
	export const set = <S, A>(lens: Lens<S, A>) => (a: A) => (s: S): S => lens.set(a)(s);

	/**
	 * Applies a function to the focused value, returning a new structure.
	 *
	 * @example
	 * ```ts
	 * pipe(user, Lens.modify(nameLens)(n => n.toUpperCase())); // "ALICE"
	 * ```
	 */
	export const modify = <S, A>(lens: Lens<S, A>) => (f: (a: A) => A) => (s: S): S => lens.set(f(lens.get(s)))(s);

	/**
	 * Composes two Lenses: focuses through the outer, then through the inner.
	 * Use in a pipe chain to build up a deep focus step by step.
	 *
	 * @example
	 * ```ts
	 * const userCityLens = pipe(
	 *   Lens.from.property<User>()("address"),
	 *   Lens.andThen(Lens.from.property<Address>()("city")),
	 * );
	 * ```
	 */
	export const andThen = <A, B>(inner: Lens<A, B>) => <S>(outer: Lens<S, A>): Lens<S, B> =>
		from.accessors((s) => inner.get(outer.get(s)), (b) => (s) => outer.set(inner.set(b)(outer.get(s)))(s));

	/**
	 * Composes a Lens with an Optional, producing an Optional.
	 * Use when the next step in the focus is optional (may be absent).
	 *
	 * @example
	 * ```ts
	 * const userBioOpt = pipe(
	 *   Lens.from.property<User>()("profile"),
	 *   Lens.andThenOptional(Optional.from.property<Profile>()("bio")),
	 * );
	 * ```
	 */
	export const andThenOptional = <A, B>(inner: Optional<A, B>) => <S>(outer: Lens<S, A>): Optional<S, B> => ({
		get: (s) => inner.get(outer.get(s)),
		set: (b) => (s) => outer.set(inner.set(b)(outer.get(s)))(s),
	});

	/**
	 * Converts a Lens to an Optional. Every Lens is a valid Optional
	 * whose get always returns Some.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Lens.from.property<User>()("address"),
	 *   Lens.toOptional,
	 *   Optional.andThen(Optional.from.property<Address>()("landmark")),
	 * );
	 * ```
	 */
	export const toOptional = <S, A>(lens: Lens<S, A>): Optional<S, A> => ({
		get: (s) => ({ kind: "Some", value: lens.get(s) }),
		set: lens.set,
	});
}
