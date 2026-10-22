import type { Lens } from "./Lens.ts";
import { Maybe } from "./Maybe.ts";

/**
 * Optional<S, A> focuses on a value A inside a structure S that may or may
 * not be present. Like a Lens, but get returns Maybe<A>.
 *
 * Compose with other Optionals via `andThen`, or with a Lens via `andThenLens`.
 * Convert a Lens to an Optional with `Lens.to.Optional`.
 *
 * @example
 * ```ts
 * type Profile = { username: string; bio?: string };
 *
 * const bioOpt = Optional.from.property<Profile>()("bio");
 *
 * pipe(profile, Optional.get(bioOpt));               // Some("hello") or None
 * pipe(profile, Optional.set(bioOpt)("hello"));      // new Profile with bio set
 * pipe(profile, Optional.modify(bioOpt)(s => s + "!")); // appends if present
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
		(items) => index >= 0 && index < items.length ? Maybe.make.some(items[index] as A) : Maybe.make.none(),
		(value) => (items) => {
			if (index < 0 || index >= items.length) { return items; }
			if (items[index] === value) { return items; }
			const copy = items.slice();
			copy[index] = value;
			return copy;
		},
	);

export const Optional = {
	// --- from ---
	from: {
		/**
		 * Constructs an Optional from a getter (returning Maybe<A>) and a setter.
		 *
		 * @see {@link Optional.from.property} to create an Optional focused on an object property.
		 *
		 * @example
		 * ```ts
		 * const firstChar = Optional.from.accessors(
		 *   (s: string) => s.length > 0 ? Maybe.make.some(s[0]) : Maybe.make.none(),
		 *   (c) => (s) => s.length > 0 ? c + s.slice(1) : s,
		 * );
		 * ```
		 */
		accessors: makeAccessors,

		/**
		 * Creates an Optional that focuses on a property of an object.
		 * Call with the structure type first, then the key.
		 *
		 * @see {@link Optional.from.index} to focus on an element of an array by index.
		 *
		 * @example
		 * ```ts
		 * type Profile = { username: string; bio?: string };
		 * const bioOpt = Optional.from.property<Profile>()("bio");
		 * ```
		 */
		property: makeProperty,

		/**
		 * Creates an Optional that focuses on an element at a given index in an array.
		 * Returns None when the index is out of bounds; set is a no-op when out of bounds.
		 *
		 * @see {@link Optional.from.property} to focus on an object property.
		 *
		 * @example
		 * ```ts
		 * const firstItem = Optional.from.index<string>(0);
		 *
		 * pipe(["a", "b"], Optional.get(firstItem)); // Some("a")
		 * pipe([], Optional.get(firstItem));         // None
		 * ```
		 */
		index: makeIndex,
	},

	/**
	 * Reads the focused value from a structure, returning Maybe<A>.
	 *
	 * @see {@link Optional.getOrElse} to extract the value with a fallback default.
	 * @see {@link Optional.match} to pattern match on present and absent states.
	 *
	 * @example
	 * ```ts
	 * pipe(profile, Optional.get(bioOpt)); // Some("...") or None
	 * ```
	 */
	get: <S, A>(opt: Optional<S, A>) => (structure: S): Maybe<A> => opt.get(structure),

	/**
	 * Replaces the focused value within a structure.
	 * For indexed focuses, this is a no-op when the index is out of bounds.
	 *
	 * @see {@link Optional.modify} to transform the focused value if present.
	 *
	 * @example
	 * ```ts
	 * pipe(profile, Optional.set(bioOpt)("hello"));
	 * ```
	 */
	set: <S, A>(opt: Optional<S, A>) => (value: A) => (structure: S): S => opt.set(value)(structure),

	/**
	 * Applies a function to the focused value if it is present; returns the
	 * structure unchanged if the focus is absent.
	 *
	 * @see {@link Optional.set} to overwrite the focused value directly.
	 *
	 * @example
	 * ```ts
	 * pipe(profile, Optional.modify(bioOpt)(s => s.toUpperCase()));
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
	 * Returns the focused value or a default when the focus is absent.
	 *
	 * @see {@link Optional.get} to extract the value as a Maybe.
	 * @see {@link Optional.match} to pattern match on presence with custom handlers.
	 *
	 * @example
	 * ```ts
	 * pipe(profile, Optional.getOrElse(bioOpt)(() => "no bio"));
	 * ```
	 */
	getOrElse: <S, A>(opt: Optional<S, A>) => (fallback: () => A) => (structure: S): A => {
		const target = opt.get(structure);
		return target.kind === "Some" ? target.value : fallback();
	},

	/**
	 * Pattern matches on an Optional focus using a named-case object.
	 *
	 * @see {@link Optional.getOrElse} to extract the value with a default fallback.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   profile,
	 *   Optional.match(bioOpt)({ none: () => "no bio", some: (bio) => bio }),
	 * );
	 * ```
	 */
	match: <S, A>(opt: Optional<S, A>) => <B>(cases: { none: () => B; some: (value: A) => B; }) => (structure: S): B => {
		const target = opt.get(structure);
		return target.kind === "Some" ? cases.some(target.value) : cases.none();
	},

	/**
	 * Composes two Optionals: focuses through the outer, then through the inner.
	 * Returns None if either focus is absent.
	 *
	 * @see {@link Optional.andThenLens} to compose an Optional with a Lens.
	 *
	 * @example
	 * ```ts
	 * const deepOpt = pipe(
	 *   Optional.from.property<User>()("address"),
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
	 *
	 * @example
	 * ```ts
	 * const cityOpt = pipe(
	 *   Optional.from.property<User>()("address"),
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
