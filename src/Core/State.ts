import type { Lens } from "./Lens.ts";

/**
 * A synchronous computation that threads a piece of mutable state `S` through
 * a pipeline without exposing mutation at call sites.
 *
 * At runtime a `State<S, A>` is just a function from an initial state to a pair
 * `[value, nextState]`. Nothing runs until you supply the initial state with
 * `State.run`, `State.evaluate`, or `State.execute`.
 *
 * @example
 * ```ts
 * type Counter = number;
 *
 * const increment: State<Counter, undefined> = State.modify(n => n + 1);
 * const getCount:  State<Counter, Counter>   = State.get();
 *
 * const program = pipe(
 *   increment,
 *   State.chain(() => increment),
 *   State.chain(() => getCount),
 * );
 *
 * State.run(0)(program); // [2, 2]  — value is 2, final state is 2
 * ```
 */
export type State<S, A> = (s: S) => readonly [A, S];

const mapState = <A, B>(transform: (value: A) => B) => <S = never>(state: State<S, A>): State<S, B> => (s) => {
	const [a, s1] = state(s);
	return [transform(a), s1];
};

const chainState = <A, S, B>(transform: (value: A) => State<S, B>) => (state: State<S, A>): State<S, B> => (s) => {
	const [a, s1] = state(s);
	return transform(a)(s1);
};

export const State = {
	/**
	 * Lifts a pure value into a State computation. The state passes through unchanged.
	 *
	 * @see {@link get} to produce the current state instead of a static value.
	 *
	 * @example
	 * ```ts
	 * State.run(10)(State.make(42)); // [42, 10] — value 42, state unchanged
	 * ```
	 */
	make: <S, A>(value: A): State<S, A> => (s) => [value, s],

	/**
	 * Produces the current state as the value, without modifying it.
	 *
	 * @see {@link put} to replace the state, or {@link modify} to transform it with a function.
	 *
	 * @example
	 * ```ts
	 * const readStack: State<string[], string[]> = State.get();
	 * State.run(["a", "b"])(readStack); // [["a", "b"], ["a", "b"]]
	 * ```
	 */
	get: <S>(): State<S, S> => (s) => [s, s],

	/**
	 * Replaces the current state with a new value. Produces no meaningful value.
	 *
	 * @see {@link get} to read the current state, or {@link modify} to transform it.
	 *
	 * @example
	 * ```ts
	 * const reset: State<number, undefined> = State.put(0);
	 * State.run(99)(reset); // [undefined, 0]
	 * ```
	 */
	put: <S>(newState: S): State<S, undefined> => (_s) => [undefined, newState],

	/**
	 * Applies a function to the current state to produce the next state.
	 * Produces no meaningful value.
	 *
	 * @see {@link put} to replace the state with a constant value, or {@link get} to read it.
	 *
	 * @example
	 * ```ts
	 * const push = (item: string): State<string[], undefined> =>
	 *   State.modify(stack => [...stack, item]);
	 *
	 * State.run(["a"])(push("b")); // [undefined, ["a", "b"]]
	 * ```
	 */
	modify: <S>(transform: (state: S) => S): State<S, undefined> => (s) => [undefined, transform(s)],

	/**
	 * Transforms the value produced by a State computation.
	 * The state transformation is unchanged.
	 *
	 * @see {@link chain} to sequence a computation that produces a new State.
	 *
	 * @example
	 * ```ts
	 * const readLength: State<string[], number> = pipe(
	 *   State.get<string[]>(),
	 *   State.map(stack => stack.length),
	 * );
	 *
	 * State.run(["a", "b", "c"])(readLength); // [3, ["a", "b", "c"]]
	 * ```
	 */
	map: mapState,

	/**
	 * Sequences two State computations. The state output of the first is passed
	 * as the state input to the second.
	 *
	 * Data-last — the first computation is the data being piped.
	 *
	 * @see {@link map} to transform the produced value without changing the state transition.
	 *
	 * @example
	 * ```ts
	 * const push = (item: string): State<string[], undefined> =>
	 *   State.modify(stack => [...stack, item]);
	 *
	 * const program = pipe(
	 *   push("a"),
	 *   State.chain(() => push("b")),
	 *   State.chain(() => State.get<string[]>()),
	 * );
	 *
	 * State.evaluate([])(program); // ["a", "b"]
	 * ```
	 */
	chain: chainState,

	/**
	 * Applies a function wrapped in a State to a value wrapped in a State.
	 * The function computation runs first; its output state is the input to the
	 * argument computation.
	 *
	 * @see {@link chain} to sequence dependent State transitions.
	 *
	 * @example
	 * ```ts
	 * const addCounted = (n: number) => (m: number) => n + m;
	 * const program = pipe(
	 *   State.make<number, typeof addCounted>(addCounted),
	 *   State.apply(pipe(State.get<number>(), State.map((s) => s * 2))),
	 *   State.apply(State.get<number>()),
	 * );
	 *
	 * State.evaluate(3)(program); // 6 + 3 = 9
	 * ```
	 */
	apply: <S, A>(arg: State<S, A>) => <B>(state: State<S, (value: A) => B>): State<S, B> => (s) => {
		const [f, s1] = state(s);
		const [a, s2] = arg(s1);
		return [f(a), s2];
	},

	/**
	 * Runs a side effect on the produced value without changing the State computation.
	 *
	 * @see {@link map} to transform the value instead of executing a side effect.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   State.get<number>(),
	 *   State.tap(n => console.log("current:", n)),
	 *   State.chain(() => State.modify(n => n + 1)),
	 * );
	 * ```
	 */
	tap: <A>(sideEffect: (value: A) => void) => <S = never>(state: State<S, A>): State<S, A> => (s) => {
		const [a, s1] = state(s);
		sideEffect(a);
		return [a, s1];
	},

	/**
	 * Runs a State computation with an initial state, returning both the
	 * produced value and the final state as a pair.
	 *
	 * Data-last — the computation is the data being piped.
	 *
	 * @see {@link evaluate} to discard the final state, or {@link execute} to discard the produced value.
	 *
	 * @example
	 * ```ts
	 * const program = pipe(
	 *   State.modify<number>(n => n + 1),
	 *   State.chain(() => State.get<number>()),
	 * );
	 *
	 * State.run(0)(program); // [1, 1]
	 * ```
	 */
	run: <S>(initialState: S) => <A>(state: State<S, A>): readonly [A, S] => state(initialState),

	/**
	 * Runs a State computation with an initial state, returning only the
	 * produced value (discarding the final state).
	 *
	 * @see {@link run} to obtain both the value and final state, or {@link execute} for only the state.
	 *
	 * @example
	 * ```ts
	 * State.evaluate([])(pipe(
	 *   State.modify<string[]>(s => [...s, "x"]),
	 *   State.chain(() => State.get<string[]>()),
	 * )); // ["x"]
	 * ```
	 */
	evaluate: <S>(initialState: S) => <A>(state: State<S, A>): A => state(initialState)[0],

	/**
	 * Runs a State computation with an initial state, returning only the
	 * final state (discarding the produced value).
	 *
	 * @see {@link run} to obtain both the value and final state, or {@link evaluate} for only the value.
	 *
	 * @example
	 * ```ts
	 * State.execute(0)(pipe(
	 *   State.modify<number>(n => n + 10),
	 *   State.chain(() => State.modify<number>(n => n * 2)),
	 * )); // 20
	 * ```
	 */
	execute: <S>(initialState: S) => <A>(state: State<S, A>): S => state(initialState)[1],

	/**
	 * Lifts a State value into an accumulator object.
	 *
	 * @see {@link assign} to accumulate subsequent State values into the object.
	 *
	 * @example
	 * ```ts
	 * pipe(State.make(42), State.assignTo("value")); // State({ value: 42 })
	 * ```
	 */
	assignTo: <K extends string>(key: K) => <S = never, A = unknown>(state: State<S, A>): State<S, { [P in K]: A; }> =>
		mapState<A, { [P in K]: A; }>((a) => ({ [key]: a } as { [P in K]: A; }))(state),

	/**
	 * Evaluates a new State using the current accumulator and attaches the output to a new key.
	 *
	 * @see {@link assignTo} to initialize the accumulator record.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   State.make({ a: 1 }),
	 *   State.assign("b", ({ a }) => State.make(a + 1))
	 * ); // State({ a: 1, b: 2 })
	 * ```
	 */
	assign:
		<K extends string, S, A, B>(key: K, transform: (value: A) => State<S, B>) =>
		(state: State<S, A>): State<S, A & { [P in K]: B; }> =>
			chainState<A, S, A & { [P in K]: B; }>((a) =>
				mapState<B, A & { [P in K]: B; }>((
					b,
				) => ({ ...(a as unknown as Record<string, unknown>), [key]: b } as A & { [P in K]: B; }))(transform(a))
			)(state),

	/**
	 * Focuses a State computation on a sub-state using a Lens.
	 *
	 * @see {@link modify} to update state directly without a Lens.
	 *
	 * @example
	 * ```ts
	 * type AppState = { count: number; name: string };
	 * const countLens = Lens.from.property<AppState>()("count");
	 * const increment = State.modify((c: number) => c + 1);
	 * const focusedProgram = pipe(increment, State.focus(countLens));
	 * ```
	 */
	focus: <S, SubState>(lens: Lens<S, SubState>) => <A>(state: State<SubState, A>): State<S, A> => (s: S) => {
		const subState = lens.get(s);
		const [a, newSubState] = state(subState);
		return [a, lens.set(newSubState)(s)];
	},
};
