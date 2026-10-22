import type { Optional } from "./Optional.ts";

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
export type Lens<S, A> = { readonly get: (structure: S) => A; readonly set: (value: A) => (structure: S) => S; };

const makeAccessors = <S, A>(get: (structure: S) => A, set: (value: A) => (structure: S) => S): Lens<S, A> => ({
	get,
	set,
});
const makeProperty = <S>() => <K extends keyof S>(key: K): Lens<S, S[K]> =>
	makeAccessors((structure) => structure[key], (value) => (structure) => ({ ...structure, [key]: value } as S));

export const Lens = {
	// --- from ---
	from: {
		/**
		 * Constructs a Lens from a getter and a setter.
		 *
		 * @see {@link Lens.from.property} to create a Lens focused on an object property.
		 *
		 * @example
		 * ```ts
		 * const nameLens = Lens.from.accessors(
		 *   (user: User) => user.name,
		 *   (name) => (user) => ({ ...user, name }),
		 * );
		 * ```
		 */
		accessors: makeAccessors,

		/**
		 * Creates a Lens that focuses on a property of an object.
		 * Call with the structure type first, then the key.
		 *
		 * @see {@link Lens.from.accessors} to construct a Lens from custom getter and setter functions.
		 *
		 * @example
		 * ```ts
		 * const nameLens = Lens.from.property<User>()("name");
		 * ```
		 */
		property: makeProperty,
	},

	/**
	 * Reads the focused value from a structure.
	 *
	 * @see {@link Lens.set} to replace the focused value.
	 * @see {@link Lens.modify} to transform the focused value with a function.
	 *
	 * @example
	 * ```ts
	 * pipe(user, Lens.get(nameLens)); // "Alice"
	 * ```
	 */
	get: <S, A>(lens: Lens<S, A>) => (structure: S): A => lens.get(structure),

	/**
	 * Replaces the focused value within a structure, returning a new structure.
	 *
	 * @see {@link Lens.get} to extract the focused value.
	 * @see {@link Lens.modify} to transform the focused value with a function.
	 *
	 * @example
	 * ```ts
	 * pipe(user, Lens.set(nameLens)("Bob")); // new User with name "Bob"
	 * ```
	 */
	set: <S, A>(lens: Lens<S, A>) => (value: A) => (structure: S): S => lens.set(value)(structure),

	/**
	 * Applies a function to the focused value, returning a new structure.
	 *
	 * @see {@link Lens.set} to overwrite the focused value directly.
	 *
	 * @example
	 * ```ts
	 * pipe(user, Lens.modify(nameLens)(n => n.toUpperCase())); // "ALICE"
	 * ```
	 */
	modify: <S, A>(lens: Lens<S, A>) => (transform: (value: A) => A) => (structure: S): S => {
		const current = lens.get(structure);
		const next = transform(current);
		return Object.is(next, current) ? structure : lens.set(next)(structure);
	},

	/**
	 * Composes two Lenses: focuses through the outer, then through the inner.
	 * Use in a pipe chain to build up a deep focus step by step.
	 *
	 * @see {@link Lens.andThenOptional} to compose a Lens with an Optional path.
	 *
	 * @example
	 * ```ts
	 * const userCityLens = pipe(
	 *   Lens.from.property<User>()("address"),
	 *   Lens.andThen(Lens.from.property<Address>()("city")),
	 * );
	 * ```
	 */
	andThen: <A, B>(inner: Lens<A, B>) => <S>(outer: Lens<S, A>): Lens<S, B> =>
		makeAccessors(
			(structure) => inner.get(outer.get(structure)),
			(value) => (structure) => outer.set(inner.set(value)(outer.get(structure)))(structure),
		),

	/**
	 * Composes a Lens with an Optional, producing an Optional.
	 * Use when the next step in the focus is optional (may be absent).
	 *
	 * @see {@link Lens.andThen} to compose two guaranteed Lens paths.
	 *
	 * @example
	 * ```ts
	 * const userBioOpt = pipe(
	 *   Lens.from.property<User>()("profile"),
	 *   Lens.andThenOptional(Optional.from.property<Profile>()("bio")),
	 * );
	 * ```
	 */
	andThenOptional: <A, B>(inner: Optional<A, B>) => <S>(outer: Lens<S, A>): Optional<S, B> => ({
		get: (structure) => inner.get(outer.get(structure)),
		set: (value) => (structure) => outer.set(inner.set(value)(outer.get(structure)))(structure),
	}),

	// --- to ---
	to: {
		/**
		 * Converts a Lens to an Optional. Every Lens is a valid Optional
		 * whose get always returns Some.
		 *
		 * @see {@link Lens.andThenOptional} to compose directly with an Optional without manual conversion.
		 *
		 * @example
		 * ```ts
		 * pipe(
		 *   Lens.from.property<User>()("address"),
		 *   Lens.to.Optional,
		 *   Optional.andThen(Optional.from.property<Address>()("landmark")),
		 * );
		 * ```
		 */
		Optional: <S, A>(lens: Lens<S, A>): Optional<S, A> => ({
			get: (structure) => ({ kind: "Some", value: lens.get(structure) }),
			set: lens.set,
		}),
	},
};
