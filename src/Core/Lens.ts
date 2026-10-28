import type { Optional } from "./Optional.ts";

/**
 * Focuses on a required property or value `A` inside a parent structure `S`,
 * providing a composable way to read, overwrite, and immutably update nested data.
 *
 * A Lens assumes the target value is guaranteed to exist.
 * For optional or indexed paths, use `Optional<S, A>`.
 *
 * @example
 * ```ts
 * type Address = { city: string; zip: string };
 * type Customer = { id: string; address: Address };
 *
 * const addressLens = Lens.from.property<Customer>()("address");
 * const cityLens = Lens.from.property<Address>()("city");
 * const customerCityLens = pipe(addressLens, Lens.andThen(cityLens));
 *
 * const customer: Customer = {
 *   id: "cust_101",
 *   address: { city: "Berlin", zip: "10115" },
 * };
 *
 * pipe(customer, Lens.get(customerCityLens)); // "Berlin"
 * pipe(customer, Lens.set(customerCityLens)("Hamburg"));
 * // { id: "cust_101", address: { city: "Hamburg", zip: "10115" } }
 * pipe(customer, Lens.modify(customerCityLens)((city) => city.toUpperCase()));
 * // { id: "cust_101", address: { city: "BERLIN", zip: "10115" } }
 * ```
 */
export type Lens<S, A> = { readonly get: (structure: S) => A; readonly set: (value: A) => (structure: S) => S; };

const makeAccessors = <S, A>(get: (structure: S) => A, set: (value: A) => (structure: S) => S): Lens<S, A> => ({
	get,
	set,
});
const makeProperty = <S>() => <K extends keyof S>(key: K): Lens<S, S[K]> =>
	makeAccessors((structure) => structure[key], (value) => (structure) => ({ ...structure, [key]: value } as S));

/**
 * Utilities for reading, overwriting, and transforming values within data structures
 * via composable bidirectional lenses.
 */
export const Lens = {
	/**
	 * Constructors for creating Lens instances from accessors or property keys.
	 */
	from: {
		/**
		 * Constructs a Lens from getter and setter functions.
		 *
		 * @see {@link Lens.from.property} to create a Lens focused on an object property.
		 *
		 * @example
		 * ```ts
		 * type Coordinate = readonly [latitude: number, longitude: number];
		 *
		 * const latitudeLens = Lens.from.accessors(
		 *   (coord: Coordinate) => coord[0],
		 *   (latitude) => (coord) => [latitude, coord[1]] as const,
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
		 * type Account = { id: string; email: string };
		 * const emailLens = Lens.from.property<Account>()("email");
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
	 * type Account = { email: string };
	 * const emailLens = Lens.from.property<Account>()("email");
	 * const account: Account = { email: "dev@example.com" };
	 *
	 * pipe(account, Lens.get(emailLens)); // "dev@example.com"
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
	 * type Account = { email: string };
	 * const emailLens = Lens.from.property<Account>()("email");
	 * const account: Account = { email: "dev@example.com" };
	 *
	 * pipe(account, Lens.set(emailLens)("ops@example.com"));
	 * // { email: "ops@example.com" }
	 * ```
	 */
	set: <S, A>(lens: Lens<S, A>) => (value: A) => (structure: S): S => lens.set(value)(structure),

	/**
	 * Applies a function to the focused value, returning a new structure.
	 * Preserves the original structure reference if the transformed value is identical.
	 *
	 * @see {@link Lens.get} to extract the focused value.
	 * @see {@link Lens.set} to overwrite the focused value directly.
	 *
	 * @example
	 * ```ts
	 * type Account = { email: string };
	 * const emailLens = Lens.from.property<Account>()("email");
	 * const account: Account = { email: "dev@example.com" };
	 *
	 * pipe(account, Lens.modify(emailLens)((email) => email.toUpperCase()));
	 * // { email: "DEV@EXAMPLE.COM" }
	 * ```
	 */
	modify: <S, A>(lens: Lens<S, A>) => (transform: (value: A) => A) => (structure: S): S => {
		const current = lens.get(structure);
		const next = transform(current);
		return Object.is(next, current) ? structure : lens.set(next)(structure);
	},

	/**
	 * Composes two lenses to focus sequentially through nested structures.
	 *
	 * @see {@link Lens.andThenOptional} to compose a Lens with an Optional path.
	 *
	 * @example
	 * ```ts
	 * type Address = { city: string };
	 * type Customer = { address: Address };
	 *
	 * const customerCityLens = pipe(
	 *   Lens.from.property<Customer>()("address"),
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
	 * Use when the next segment in the path may be absent.
	 *
	 * @see {@link Lens.andThen} to compose two guaranteed Lens paths.
	 *
	 * @example
	 * ```ts
	 * type Profile = { bio?: string };
	 * type Account = { profile: Profile };
	 *
	 * const bioOptional = pipe(
	 *   Lens.from.property<Account>()("profile"),
	 *   Lens.andThenOptional(Optional.from.property<Profile>()("bio")),
	 * );
	 * ```
	 */
	andThenOptional: <A, B>(inner: Optional<A, B>) => <S>(outer: Lens<S, A>): Optional<S, B> => ({
		get: (structure) => inner.get(outer.get(structure)),
		set: (value) => (structure) => outer.set(inner.set(value)(outer.get(structure)))(structure),
	}),

	/**
	 * Converters from Lens to wider optic representations.
	 */
	to: {
		/**
		 * Converts a Lens to an Optional whose getter always yields Some.
		 *
		 * @see {@link Lens.andThenOptional} to compose directly with an Optional without manual conversion.
		 *
		 * @example
		 * ```ts
		 * type Address = { street: string };
		 * type User = { address: Address };
		 *
		 * const addressOptional = Lens.to.Optional(Lens.from.property<User>()("address"));
		 * ```
		 */
		Optional: <S, A>(lens: Lens<S, A>): Optional<S, A> => ({
			get: (structure) => ({ kind: "Some", value: lens.get(structure) }),
			set: lens.set,
		}),
	},
};
