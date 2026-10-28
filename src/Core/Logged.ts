import { WithLog, WithValue } from "#internal";
import type { Lens } from "./Lens.ts";
import type { Pair } from "./Pair.ts";

/**
 * A value paired with an accumulated log.
 *
 * `Logged<L, A>` pairs a result `A` with an immutable sequence of log entries `L`.
 * When you sequence computations with `chain`, the logs are automatically
 * concatenated in execution order without manual threading.
 *
 * @example
 * ```ts
 * const program = pipe(
 *   Logged.make(0),
 *   Logged.chain(n => pipe(
 *     Logged.from.entry("start"),
 *     Logged.map(() => n + 1),
 *   )),
 *   Logged.chain(n => pipe(
 *     Logged.from.entry("done"),
 *     Logged.map(() => n * 10),
 *   )),
 * );
 *
 * const [value, log] = Logged.to.Pair(program); // [10, ["start", "done"]]
 * ```
 */
export type Logged<L, A> = WithValue<A> & WithLog<L>;

const makeEntry = <L>(logEntry: L): Logged<L, undefined> => ({ value: undefined, log: [logEntry] });

const mapLogged = <A, B>(transform: (value: A) => B) => <L = never>(logged: Logged<L, A>): Logged<L, B> => ({
	value: transform(logged.value),
	log: logged.log,
});

const chainLogged =
	<A, L2, B>(transform: (value: A) => Logged<L2, B>) => <L1 = never>(logged: Logged<L1, A>): Logged<L1 | L2, B> => {
		const next = transform(logged.value);
		return { value: next.value, log: [...logged.log, ...next.log] };
	};

export const Logged = {
	/**
	 * Creates a `Logged` container with a value and an optional initial log array.
	 *
	 * @see {@link Logged.from.entry} to record a single log entry without a value.
	 * @see {@link Logged.to.Pair} to extract value and logs at the system boundary.
	 * @example
	 * ```ts
	 * Logged.make(42);                  // { value: 42, log: [] }
	 * Logged.make(42, ["initialized"]); // { value: 42, log: ["initialized"] }
	 * ```
	 */
	make: <L = never, A = unknown>(value: A, log: readonly L[] = []): Logged<L, A> => ({ value, log: [...log] }),

	// --- from ---
	from: {
		/**
		 * Creates a `Logged` container that records a single log entry and sets the value to undefined.
		 * Use this to append to the log inside a `chain` step.
		 *
		 * @see {@link Logged.make} to create a value with an initial log.
		 * @see {@link Logged.to.Pair} to extract value and log at the boundary.
		 * @example
		 * ```ts
		 * Logged.from.entry("operation completed"); // { value: undefined, log: ["operation completed"] }
		 * ```
		 */
		entry: makeEntry,
	},

	// --- to ---
	to: {
		/**
		 * Extracts the contained value and accumulated log entries as a `Pair<A, ReadonlyArray<L>>`.
		 *
		 * @see {@link Logged.make} to construct a Logged container.
		 * @see {@link Logged.from.entry} to record standalone entries.
		 * @example
		 * ```ts
		 * const [value, log] = Logged.to.Pair(Logged.make(42, ["init"]));
		 * // value = 42, log = ["init"]
		 * ```
		 */
		Pair: <L, A>(logged: Logged<L, A>): Pair<A, ReadonlyArray<L>> => [logged.value, logged.log],
	},

	/**
	 * Transforms the value inside a `Logged` container while preserving accumulated logs.
	 *
	 * @see {@link Logged.chain} to sequence operations that also produce logs.
	 * @see {@link Logged.mapLog} to transform the accumulated log entries instead.
	 * @example
	 * ```ts
	 * pipe(
	 *   Logged.make(5),
	 *   Logged.map(n => n * 2),
	 * ); // { value: 10, log: [] }
	 * ```
	 */
	map: mapLogged,

	/**
	 * Transforms all accumulated log entries with a mapping function while preserving the value.
	 *
	 * @see {@link Logged.map} to transform the contained value instead.
	 * @see {@link Logged.tapLog} to inspect logs without changing them.
	 * @example
	 * ```ts
	 * pipe(
	 *   Logged.make(42, ["step 1", "step 2"]),
	 *   Logged.mapLog(entry => entry.toUpperCase()),
	 * ); // { value: 42, log: ["STEP 1", "STEP 2"] }
	 * ```
	 */
	mapLog: <L1, L2>(transform: (logEntry: L1) => L2) => <A = never>(logged: Logged<L1, A>): Logged<L2, A> => ({
		value: logged.value,
		log: logged.log.map(transform),
	}),

	/**
	 * Sequences two `Logged` computations, concatenating their logs in order.
	 * The value from the first computation is passed to `transform`.
	 *
	 * @see {@link Logged.map} to transform values without appending new log entries.
	 * @see {@link Logged.apply} to combine independent computations wrapped in Logged containers.
	 * @example
	 * ```ts
	 * const result = pipe(
	 *   Logged.make(1),
	 *   Logged.chain(n => pipe(Logged.from.entry("step"), Logged.map(() => n + 1))),
	 *   Logged.chain(n => pipe(Logged.from.entry("done"), Logged.map(() => n * 10))),
	 * );
	 *
	 * Logged.to.Pair(result); // [20, ["step", "done"]]
	 * ```
	 */
	chain: chainLogged,

	/**
	 * Applies a function wrapped in a `Logged` container to an argument wrapped in a `Logged` container,
	 * concatenating both logs in order.
	 *
	 * @see {@link Logged.chain} to sequence dependent computations.
	 * @see {@link Logged.map} to transform values with a plain un-wrapped function.
	 * @example
	 * ```ts
	 * const fn = Logged.make((n: number) => n * 2, ["fn-loaded"]);
	 * const arg = Logged.make(5, ["arg-loaded"]);
	 *
	 * const result = pipe(fn, Logged.apply(arg));
	 * Logged.to.Pair(result); // [10, ["fn-loaded", "arg-loaded"]]
	 * ```
	 */
	apply:
		<L2 = never, A = unknown>(arg: Logged<L2, A>) =>
		<B, L1 = never>(logged: Logged<L1, (value: A) => B>): Logged<L1 | L2, B> => ({
			value: logged.value(arg.value),
			log: [...logged.log, ...arg.log],
		}),

	/**
	 * Runs a side effect on the value without modifying the value or the log.
	 *
	 * @see {@link Logged.tapLog} to inspect accumulated logs instead.
	 * @example
	 * ```ts
	 * pipe(
	 *   Logged.make(42),
	 *   Logged.tap(n => console.log("value:", n)),
	 * );
	 * ```
	 */
	tap: <A>(sideEffect: (value: A) => void) => <L = never>(logged: Logged<L, A>): Logged<L, A> => {
		sideEffect(logged.value);
		return logged;
	},

	/**
	 * Runs a side effect on the accumulated logs without modifying the value or the log.
	 *
	 * @see {@link Logged.tap} to inspect the value instead.
	 * @see {@link Logged.mapLog} to transform log entries instead.
	 * @example
	 * ```ts
	 * pipe(
	 *   Logged.make(42, ["step 1"]),
	 *   Logged.tapLog(entries => console.log(`Logged ${entries.length} items`)),
	 * );
	 * ```
	 */
	tapLog: <L>(sideEffect: (log: ReadonlyArray<L>) => void) => <A = never>(logged: Logged<L, A>): Logged<L, A> => {
		sideEffect(logged.log);
		return logged;
	},

	/**
	 * Wraps a Logged value in an accumulator record with a single specified key.
	 * Initiates the pipeline accumulator object.
	 *
	 * @see {@link Logged.bind} to attach subsequent values to the accumulator object.
	 * @example
	 * ```ts
	 * pipe(Logged.make(42), Logged.bindTo("value")); // { value: { value: 42 }, log: [] }
	 * ```
	 */
	bindTo: <K extends string>(key: K) => <A, L = never>(logged: Logged<L, A>): Logged<L, { [P in K]: A; }> => ({
		value: { [key]: logged.value } as { [P in K]: A; },
		log: logged.log,
	}),

	/**
	 * Evaluates a new Logged computation using the current accumulator object and attaches the result to a new key.
	 *
	 * @see {@link Logged.bindTo} to initiate the accumulator object.
	 * @example
	 * ```ts
	 * pipe(
	 *   Logged.make({ a: 1 }),
	 *   Logged.bind("b", ({ a }) => Logged.make(a + 1, ["computed b"])),
	 * ); // { value: { a: 1, b: 2 }, log: ["computed b"] }
	 * ```
	 */
	bind:
		<K extends string, L2, A, B>(key: K, transform: (value: A) => Logged<L2, B>) =>
		<L1 = never>(logged: Logged<L1, A>): Logged<L1 | L2, A & { [P in K]: B; }> => {
			const next = transform(logged.value);
			return {
				value: { ...(logged.value as Record<string, unknown>), [key]: next.value } as A & { [P in K]: B; },
				log: [...logged.log, ...next.log],
			};
		},

	/**
	 * Focuses a Logged computation on a sub-field of a data structure using a Lens,
	 * updating the focused property while accumulating any logs generated during the sub-computation.
	 *
	 * @see {@link Lens} for constructing composable property focus optics.
	 * @see {@link Logged.chain} to sequence transformations at the root container level.
	 * @example
	 * ```ts
	 * type User = { profile: { name: string } };
	 * const profileLens = Lens.from.property<User>()("profile");
	 * const logged = Logged.make<string, User>({ profile: { name: "alice" } });
	 *
	 * pipe(
	 *   logged,
	 *   Logged.focus(profileLens)(p => Logged.make({ name: p.name.toUpperCase() }, ["capitalized name"])),
	 * );
	 * ```
	 */
	focus:
		<S, A>(lens: Lens<S, A>) =>
		<L2, B extends A = A>(transform: (value: A) => Logged<L2, B>) =>
		<L1 = never>(logged: Logged<L1, S>): Logged<L1 | L2, S> => {
			const next = transform(lens.get(logged.value));
			return { value: lens.set(next.value)(logged.value), log: [...logged.log, ...next.log] };
		},
};
