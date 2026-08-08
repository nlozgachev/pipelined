import type { Thenable } from "#internal";

declare const _deferred: unique symbol;

/**
 * A nominally typed, one-shot async value that supports `await` but enforces infallibility.
 *
 * Two design choices work together to make the guarantee structural rather than documentary:
 *
 * - The phantom `[_deferred]` symbol makes the type **nominal**: only values produced by
 *   `Deferred.from.Promise` satisfy it. A plain object `{ then: ... }` does not.
 * - The single-parameter `.then()` **excludes rejection handlers** by construction. There is
 *   no second argument to pass, so chaining and `.catch()` are impossible.
 *
 * This makes `Deferred<A>` the natural return type for `Task<A>`, which is guaranteed to
 * never reject.
 *
 * @example
 * ```ts
 * const value = await Deferred.from.Promise(Promise.resolve(42));
 * // value === 42
 * ```
 */
export type Deferred<A> = { readonly [_deferred]: A; readonly then: (onfulfilled: (value: A) => unknown) => void; };

export namespace Deferred {
	// --- from ---
	export namespace from {
		/**
		 * Wraps a `Promise` or `Deferred` into a `Deferred`, structurally excluding rejection handlers,
		 * `.catch()`, `.finally()`, and chainable `.then()`.
		 *
		 * **Precondition**: `p` must never reject. If `p` rejects, the returned `Deferred` will
		 * never resolve — `await`-ing it will hang indefinitely. Use `Task.Result.tryCatch` to
		 * handle operations that may fail before converting to a `Deferred`.
		 *
		 * @example
		 * ```ts
		 * const d = Deferred.from.Promise(Promise.resolve("hello"));
		 * const value = await d; // "hello"
		 * ```
		 */
		export const Promise = <A>(p: Thenable<A>): Deferred<A> =>
			// eslint-disable-next-line unicorn/no-thenable -- Deferred is intentionally thenable; it is the mechanism that makes Task awaitable
			({ then: ((f) => p.then(f)) as Deferred<A>["then"] }) as Deferred<A>;
	}

	// --- to ---
	export namespace to {
		/**
		 * Converts a `Deferred` back into a `Promise`.
		 *
		 * @example
		 * ```ts
		 * const p = Deferred.to.Promise(Deferred.from.Promise(Promise.resolve(42)));
		 * // p is Promise<42>
		 * ```
		 */
		export const Promise = <A>(d: Deferred<A>): globalThis.Promise<A> =>
			new globalThis.Promise<A>((resolve) => d.then(resolve));
	}

	/**
	 * Combines an array or tuple of `Deferred` values into a single `Deferred` of a tuple.
	 * Resolves when all input `Deferred`s resolve.
	 *
	 * @example
	 * ```ts
	 * const [a, b] = await Deferred.all([d1, d2]);
	 * ```
	 */
	export const all = <T extends readonly Deferred<unknown>[]>(
		deferreds: T,
	): Deferred<{ [K in keyof T]: T[K] extends Deferred<infer A> ? A : never; }> =>
		from.Promise(globalThis.Promise.all(deferreds.map((d) => to.Promise(d)))) as Deferred<
			{ [K in keyof T]: T[K] extends Deferred<infer A> ? A : never; }
		>;

	/**
	 * Races multiple `Deferred` values and resolves with the first one to settle.
	 *
	 * @example
	 * ```ts
	 * const winner = await Deferred.race([d1, d2]);
	 * ```
	 */
	export const race = <A>(deferreds: ReadonlyArray<Deferred<A>>): Deferred<A> =>
		from.Promise(globalThis.Promise.race(deferreds.map((d) => to.Promise(d))));
}
