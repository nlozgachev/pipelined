import type { Lens } from "./Lens.ts";
import { Maybe } from "./Maybe.ts";

/**
 * Focuses on a property or indexed value `A` inside a parent structure `S` that may or
 * may not be present, providing a composable way to safely read, overwrite, and immutably
 * transform nested nullable data.
 *
 * Reads return `Maybe<A>`. Overwriting or modifying returns the original structure
 * unchanged if the path is broken.
 *
 * Compose with other Optionals via `andThen`, or with a Lens via `andThenLens`.
 *
 * @example
 * ```ts
 * type Profile = { username: string; bio?: string };
 *
 * const bioOptional = Optional.from.property<Profile>()("bio");
 * const profile: Profile = { username: "alex", bio: "Engineer" };
 *
 * pipe(profile, Optional.get(bioOptional)); // Some("Engineer")
 * pipe(profile, Optional.set(bioOptional)("Staff Engineer"));
 * // { username: "alex", bio: "Staff Engineer" }
 * pipe(profile, Optional.modify(bioOptional)((bio) => bio.toUpperCase()));
 * // { username: "alex", bio: "ENGINEER" }
 * ```
 */
export type Optional<S, A> = {
	readonly get: (structure: S) => Maybe<A>;
	readonly set: (value: A) => (structure: S) => S;
};

const makeAccessors = <S, A>(
	get: (structure: S) => Maybe<A>,
	set: (value: A) => (structure: S) => S,
): Optional<S, A> => ({ get, set });

const makeProperty = <S>() => <K extends keyof S>(key: K): Optional<S, NonNullable<S[K]>> =>
	makeAccessors((structure) => {
		const val = structure[key];
		return val !== null && val !== undefined ? Maybe.make.some(val as NonNullable<S[K]>) : Maybe.make.none();
	}, (value) => (structure) => ({ ...structure, [key]: value } as S));

const makeIndex = <A>(index: number): Optional<readonly A[], A> =>
	makeAccessors<readonly A[], A>(
		(items) =>
			Number.isInteger(index) && index >= 0 && index < items.length
				? Maybe.make.some(items[index] as A)
				: Maybe.make.none(),
		(value) => (items) => {
			if (!Number.isInteger(index) || index < 0 || index >= items.length) { return items; }
			if (items[index] === value) { return items; }
			const copy = items.slice();
			copy[index] = value;
			return copy;
		},
	);

/**
 * Utilities for reading, overwriting, and transforming values along nullable
 * or indexed paths via composable optionals.
 */
export const Optional = {
	/**
	 * Constructors for creating Optional instances from accessors, property keys, or array indices.
	 */
	from: {
		/**
		 * Constructs an Optional from a getter (returning Maybe) and a setter function.
		 *
		 * @see {@link Optional.from.property} to create an Optional focused on an object property.
		 * @see {@link Optional.from.index} to focus on an array element by index.
		 *
		 * @example
		 * ```ts
		 * const firstChar = Optional.from.accessors(
		 *   (text: string) => text.length > 0 ? Maybe.make.some(text[0]) : Maybe.make.none(),
		 *   (char) => (text) => text.length > 0 ? char + text.slice(1) : text,
		 * );
		 * ```
		 */
		accessors: makeAccessors,

		/**
		 * Creates an Optional that focuses on an optional or nullable property of an object.
		 * Call with the structure type first, then the key.
		 *
		 * @see {@link Optional.from.accessors} to construct an Optional from custom getter and setter functions.
		 * @see {@link Optional.from.index} to focus on an element of an array by index.
		 *
		 * @example
		 * ```ts
		 * type Profile = { username: string; bio?: string };
		 * const bioOptional = Optional.from.property<Profile>()("bio");
		 * ```
		 */
		property: makeProperty,

		/**
		 * Creates an Optional that focuses on an element at a given index in an array.
		 * Returns None when the index is out of bounds; set is a no-op when out of bounds.
		 *
		 * @see {@link Optional.from.property} to focus on an object property.
		 * @see {@link Optional.from.accessors} to construct an Optional from custom getter and setter functions.
		 *
		 * @example
		 * ```ts
		 * const firstItem = Optional.from.index<string>(0);
		 *
		 * pipe(["ready", "running"], Optional.get(firstItem)); // Some("ready")
		 * pipe([], Optional.get(firstItem));                   // None
		 * ```
		 */
		index: makeIndex,
	},

	/**
	 * Reads the focused value from a structure, returning Maybe<A>.
	 *
	 * @see {@link Optional.set} to overwrite the focused value if present.
	 * @see {@link Optional.modify} to transform the focused value if present.
	 * @see {@link Optional.getOrElse} to extract the value with a fallback default.
	 * @see {@link Optional.match} to pattern match on present and absent states.
	 *
	 * @example
	 * ```ts
	 * type UserProfile = { bio?: string };
	 * const bioOptional = Optional.from.property<UserProfile>()("bio");
	 * const profile: UserProfile = { bio: "Platform engineer" };
	 *
	 * pipe(profile, Optional.get(bioOptional)); // Some("Platform engineer")
	 * ```
	 */
	get: <S, A>(opt: Optional<S, A>) => (structure: S): Maybe<A> => opt.get(structure),

	/**
	 * Replaces the focused value within a structure.
	 * For indexed focuses, this is a no-op when the index is out of bounds.
	 *
	 * @see {@link Optional.get} to extract the focused value as a Maybe.
	 * @see {@link Optional.modify} to transform the focused value if present.
	 *
	 * @example
	 * ```ts
	 * type UserProfile = { bio?: string };
	 * const bioOptional = Optional.from.property<UserProfile>()("bio");
	 * const profile: UserProfile = { bio: "Platform engineer" };
	 *
	 * pipe(profile, Optional.set(bioOptional)("Staff engineer"));
	 * // { bio: "Staff engineer" }
	 * ```
	 */
	set: <S, A>(opt: Optional<S, A>) => (value: A) => (structure: S): S => opt.set(value)(structure),

	/**
	 * Applies a function to the focused value if it is present; returns the
	 * structure unchanged if the focus is absent.
	 *
	 * @see {@link Optional.get} to extract the focused value as a Maybe.
	 * @see {@link Optional.set} to overwrite the focused value directly.
	 *
	 * @example
	 * ```ts
	 * type UserProfile = { bio?: string };
	 * const bioOptional = Optional.from.property<UserProfile>()("bio");
	 * const profile: UserProfile = { bio: "platform engineer" };
	 *
	 * pipe(profile, Optional.modify(bioOptional)((bio) => bio.toUpperCase()));
	 * // { bio: "PLATFORM ENGINEER" }
	 * ```
	 */
	modify: <S, A>(opt: Optional<S, A>) => (transform: (value: A) => A) => (structure: S): S => {
		const target = opt.get(structure);
		if (target.kind === "None") {
			return structure;
		}
		const next = transform(target.value);
		return Object.is(next, target.value) ? structure : opt.set(next)(structure);
	},

	/**
	 * Returns the focused value or a fallback default when the focus is absent.
	 *
	 * @see {@link Optional.get} to extract the value as a Maybe.
	 * @see {@link Optional.match} to pattern match on presence with custom handlers.
	 *
	 * @example
	 * ```ts
	 * type UserProfile = { bio?: string };
	 * const bioOptional = Optional.from.property<UserProfile>()("bio");
	 * const profile: UserProfile = {};
	 *
	 * pipe(profile, Optional.getOrElse(bioOptional)(() => "No bio provided"));
	 * // "No bio provided"
	 * ```
	 */
	getOrElse: <S, A>(opt: Optional<S, A>) => <B>(fallback: () => B) => (structure: S): A | B => {
		const target = opt.get(structure);
		return target.kind === "Some" ? target.value : fallback();
	},

	/**
	 * Pattern matches on an Optional focus using a named-case object.
	 *
	 * @see {@link Optional.get} to extract the value as a Maybe.
	 * @see {@link Optional.getOrElse} to extract the value with a default fallback.
	 *
	 * @example
	 * ```ts
	 * type UserProfile = { bio?: string };
	 * const bioOptional = Optional.from.property<UserProfile>()("bio");
	 * const profile: UserProfile = { bio: "Staff engineer" };
	 *
	 * pipe(
	 *   profile,
	 *   Optional.match(bioOptional)({
	 *     none: () => "Empty profile",
	 *     some: (bio) => `Bio: ${bio}`,
	 *   }),
	 * ); // "Bio: Staff engineer"
	 * ```
	 */
	match: <S, A>(opt: Optional<S, A>) => <B>(cases: { none: () => B; some: (value: A) => B; }) => (structure: S): B => {
		const target = opt.get(structure);
		return target.kind === "Some" ? cases.some(target.value) : cases.none();
	},

	/**
	 * Composes two optionals sequentially, yielding None if either segment is absent.
	 *
	 * @see {@link Optional.andThenLens} to compose an Optional with a Lens.
	 *
	 * @example
	 * ```ts
	 * type Address = { landmark?: string };
	 * type Account = { address?: Address };
	 *
	 * const landmarkOptional = pipe(
	 *   Optional.from.property<Account>()("address"),
	 *   Optional.andThen(Optional.from.property<Address>()("landmark")),
	 * );
	 * ```
	 */
	andThen: <A, B>(inner: Optional<A, B>) => <S>(outer: Optional<S, A>): Optional<S, B> =>
		makeAccessors((structure) => {
			const mid = outer.get(structure);
			return mid.kind === "None" ? Maybe.make.none() : inner.get(mid.value);
		}, (value) => (structure) => {
			const mid = outer.get(structure);
			return mid.kind === "None" ? structure : outer.set(inner.set(value)(mid.value))(structure);
		}),

	/**
	 * Composes an Optional with a Lens, producing an Optional.
	 * The Lens focuses within the value found by the Optional.
	 *
	 * @see {@link Optional.andThen} to compose two Optional paths.
	 * @see {@link Lens.andThenOptional} to compose a Lens with an Optional path.
	 *
	 * @example
	 * ```ts
	 * type Address = { city: string };
	 * type Account = { address?: Address };
	 *
	 * const cityOptional = pipe(
	 *   Optional.from.property<Account>()("address"),
	 *   Optional.andThenLens(Lens.from.property<Address>()("city")),
	 * );
	 * ```
	 */
	andThenLens: <A, B>(inner: Lens<A, B>) => <S>(outer: Optional<S, A>): Optional<S, B> =>
		makeAccessors((structure) => {
			const mid = outer.get(structure);
			return mid.kind === "None" ? Maybe.make.none() : Maybe.make.some(inner.get(mid.value));
		}, (value) => (structure) => {
			const mid = outer.get(structure);
			return mid.kind === "None" ? structure : outer.set(inner.set(value)(mid.value))(structure);
		}),
};
