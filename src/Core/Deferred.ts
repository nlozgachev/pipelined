declare const _deferred: unique symbol;

const _store = new WeakMap<object, Promise<unknown>>();

/**
 * A nominally typed, one-shot async value that supports `await` but enforces infallibility.
 *
 * Two design choices work together to make the guarantee structural rather than documentary:
 *
 * - The phantom `[_deferred]` symbol makes the type **nominal**: only values produced by
 *   `Deferred.fromPromise` satisfy it. A plain object `{ then: ... }` does not.
 * - The single-parameter `.then()` **excludes rejection handlers** by construction. There is
 *   no second argument to pass, so chaining and `.catch()` are impossible.
 *
 * This makes `Deferred<A>` the natural return type for `Task<A>`, which is guaranteed to
 * never reject.
 *
 * @example
 * ```ts
 * const value = await Deferred.fromPromise(Promise.resolve(42));
 * // value === 42
 * ```
 */
export type Deferred<A> = {
	readonly [_deferred]: A;
	readonly then: (onfulfilled: (value: A) => void) => void;
};

export namespace Deferred {
	/**
	 * Wraps a `Promise` into a `Deferred`, structurally excluding rejection handlers,
	 * `.catch()`, `.finally()`, and chainable `.then()`.
	 *
	 * @example
	 * ```ts
	 * const d = Deferred.fromPromise(Promise.resolve("hello"));
	 * const value = await d; // "hello"
	 * ```
	 */
	export const fromPromise = <A>(p: Promise<A>): Deferred<A> => {
		const d = ({ then: ((f) => p.then(f)) as Deferred<A>["then"] }) as Deferred<A>;
		_store.set(d as object, p);
		return d;
	};

	/**
	 * Converts a `Deferred` back into a `Promise`.
	 *
	 * @example
	 * ```ts
	 * const p = Deferred.toPromise(Deferred.fromPromise(Promise.resolve(42)));
	 * // p is Promise<42>
	 * ```
	 */
	export const toPromise = <A>(d: Deferred<A>): Promise<A> =>
		(_store.get(d as object) as Promise<A> | undefined) ??
			new Promise((resolve) => d.then(resolve));
}
