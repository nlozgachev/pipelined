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

export namespace State {
  /**
   * Lifts a pure value into a State computation. The state passes through unchanged.
   *
   * @example
   * ```ts
   * State.run(10)(State.resolve(42)); // [42, 10] — value 42, state unchanged
   * ```
   */
  export const resolve = <S, A>(value: A): State<S, A> => (s) => [value, s];

  /**
   * Produces the current state as the value, without modifying it.
   *
   * @example
   * ```ts
   * const readStack: State<string[], string[]> = State.get();
   * State.run(["a", "b"])(readStack); // [["a", "b"], ["a", "b"]]
   * ```
   */
  export const get = <S>(): State<S, S> => (s) => [s, s];

  /**
   * Reads a projection of the state without modifying it.
   * Equivalent to `pipe(State.get(), State.map(f))` but more direct.
   *
   * @example
   * ```ts
   * type AppState = { count: number; label: string };
   * const readCount: State<AppState, number> = State.gets(s => s.count);
   * State.run({ count: 5, label: "x" })(readCount); // [5, { count: 5, label: "x" }]
   * ```
   */
  export const gets = <S, A>(f: (s: S) => A): State<S, A> => (s) => [f(s), s];

  /**
   * Replaces the current state with a new value. Produces no meaningful value.
   *
   * @example
   * ```ts
   * const reset: State<number, undefined> = State.put(0);
   * State.run(99)(reset); // [undefined, 0]
   * ```
   */
  export const put = <S>(newState: S): State<S, undefined> => (_s) => [undefined, newState];

  /**
   * Applies a function to the current state to produce the next state.
   * Produces no meaningful value.
   *
   * @example
   * ```ts
   * const push = (item: string): State<string[], undefined> =>
   *   State.modify(stack => [...stack, item]);
   *
   * State.run(["a"])(push("b")); // [undefined, ["a", "b"]]
   * ```
   */
  export const modify = <S>(f: (s: S) => S): State<S, undefined> => (s) => [undefined, f(s)];

  /**
   * Transforms the value produced by a State computation.
   * The state transformation is unchanged.
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
  export const map = <S, A, B>(f: (a: A) => B) => (st: State<S, A>): State<S, B> => (s) => {
    const [a, s1] = st(s);
    return [f(a), s1];
  };

  /**
   * Sequences two State computations. The state output of the first is passed
   * as the state input to the second.
   *
   * Data-last — the first computation is the data being piped.
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
  export const chain =
    <S, A, B>(f: (a: A) => State<S, B>) => (st: State<S, A>): State<S, B> => (s) => {
      const [a, s1] = st(s);
      return f(a)(s1);
    };

  /**
   * Applies a function wrapped in a State to a value wrapped in a State.
   * The function computation runs first; its output state is the input to the
   * argument computation.
   *
   * @example
   * ```ts
   * const addCounted = (n: number) => (m: number) => n + m;
   * const program = pipe(
   *   State.resolve<number, typeof addCounted>(addCounted),
   *   State.ap(State.gets((s: number) => s * 2)),
   *   State.ap(State.gets((s: number) => s)),
   * );
   *
   * State.evaluate(3)(program); // 6 + 3 = 9
   * ```
   */
  export const ap =
    <S, A>(arg: State<S, A>) => <B>(fn: State<S, (a: A) => B>): State<S, B> => (s) => {
      const [f, s1] = fn(s);
      const [a, s2] = arg(s1);
      return [f(a), s2];
    };

  /**
   * Runs a side effect on the produced value without changing the State computation.
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
  export const tap = <S, A>(f: (a: A) => void) => (st: State<S, A>): State<S, A> => (s) => {
    const [a, s1] = st(s);
    f(a);
    return [a, s1];
  };

  /**
   * Runs a State computation with an initial state, returning both the
   * produced value and the final state as a pair.
   *
   * Data-last — the computation is the data being piped.
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
  export const run = <S>(initialState: S) => <A>(st: State<S, A>): readonly [A, S] =>
    st(initialState);

  /**
   * Runs a State computation with an initial state, returning only the
   * produced value (discarding the final state).
   *
   * @example
   * ```ts
   * State.evaluate([])(pipe(
   *   State.modify<string[]>(s => [...s, "x"]),
   *   State.chain(() => State.get<string[]>()),
   * )); // ["x"]
   * ```
   */
  export const evaluate = <S>(initialState: S) => <A>(st: State<S, A>): A => st(initialState)[0];

  /**
   * Runs a State computation with an initial state, returning only the
   * final state (discarding the produced value).
   *
   * @example
   * ```ts
   * State.execute(0)(pipe(
   *   State.modify<number>(n => n + 10),
   *   State.chain(() => State.modify<number>(n => n * 2)),
   * )); // 20
   * ```
   */
  export const execute = <S>(initialState: S) => <A>(st: State<S, A>): S => st(initialState)[1];
}
