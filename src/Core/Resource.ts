import { Deferred, Result, type Task, Task as CoreTask } from "#core";

/**
 * A Resource pairs an async acquisition step with a guaranteed cleanup step.
 *
 * Use it whenever something must be explicitly closed, released, or torn down
 * after you are done with it — database connections, file handles, locks,
 * temporary directories, or any object with a lifecycle.
 *
 * The key guarantee: `release` always runs after `Resource.use`, even when
 * the work function returns an error. If `acquire` itself fails, `release` is
 * skipped — there is nothing to clean up.
 *
 * Build a Resource with `Resource.from.handlers` or `Resource.from.Task`, then run it
 * with `Resource.use`.
 *
 * @example
 * ```ts
 * const dbResource = Resource.from.handlers(
 *   Task.Result.tryCatch(() => openConnection(config), (e) => new DbError(e)),
 *   (conn) => Task.from.Promise(() => conn.close())
 * );
 *
 * const result = await pipe(
 *   dbResource,
 *   Resource.use((conn) => queryUser(conn, userId))
 * )();
 * // conn.close() is called whether queryUser succeeds or fails
 * ```
 */
export type Resource<E, A> = { readonly acquire: Task.Result<E, A>; readonly release: (a: A) => Task<void>; };

export namespace Resource {
	// --- from ---
	export namespace from {
		/**
		 * Creates a Resource from an acquire operation that may fail and a release function.
		 *
		 * @example
		 * ```ts
		 * const fileResource = Resource.from.handlers(
		 *   Task.Result.tryCatch(() => fs.promises.open("data.csv", "r"), toFileError),
		 *   (handle) => Task.from.Promise(() => handle.close())
		 * );
		 * ```
		 */
		export const handlers = <E, A>(acquire: Task.Result<E, A>, release: (a: A) => Task<void>): Resource<E, A> => ({
			acquire,
			release,
		});

		/**
		 * Creates a Resource from an acquire operation that cannot fail.
		 * Use this when opening the resource is guaranteed to succeed, such as
		 * in-memory locks, counters, or timers.
		 *
		 * @example
		 * ```ts
		 * const timerResource = Resource.from.Task<never, Timer>(
		 *   Task.from.Promise(() => Promise.resolve(startTimer())),
		 *   (timer) => Task.from.Promise(() => Promise.resolve(timer.stop()))
		 * );
		 * ```
		 */
		export const Task = <E, A>(acquire: Task<A>, release: (a: A) => Task<void>): Resource<E, A> => ({
			acquire: CoreTask.map((a: A): Result<E, A> => Result.make.ok(a))(acquire),
			release,
		});
	}

	/**
	 * Acquires the resource, runs `f` with it, then releases it.
	 *
	 * Release always runs, even when `f` returns an error.
	 * If acquire fails, `f` and release are both skipped and the error is returned.
	 *
	 * @example
	 * ```ts
	 * const rows = await pipe(
	 *   dbResource,
	 *   Resource.use((conn) => runQuery(conn, "SELECT * FROM users"))
	 * )();
	 * // conn is closed whether the query succeeds or fails
	 * ```
	 */
	export const use = <E, A, B>(f: (a: A) => Task.Result<E, B>) => (resource: Resource<E, A>): Task.Result<E, B> =>
		CoreTask.from.Promise((signal) =>
			Deferred.to.Promise(resource.acquire(signal)).then(async (acquired) => {
				if (Result.is.err(acquired)) { return acquired as Result<E, B>; }
				const a = acquired.value;
				try {
					const usageResult = await Deferred.to.Promise(f(a)(signal));
					return usageResult;
				} finally {
					await Deferred.to.Promise(resource.release(a)(signal));
				}
			})
		);

	/**
	 * Acquires two resources in sequence and presents them as a tuple.
	 * Resources are released in reverse order: the second is released before the first.
	 *
	 * If the second resource fails to acquire, the first is released immediately
	 * before returning the error.
	 *
	 * @example
	 * ```ts
	 * const combined = Resource.combine(dbResource, cacheResource);
	 *
	 * const result = await pipe(
	 *   combined,
	 *   Resource.use(([conn, cache]) => lookupWithFallback(conn, cache, userId))
	 * )();
	 * ```
	 */
	export const combine = <E, A, B>(
		resourceA: Resource<E, A>,
		resourceB: Resource<E, B>,
	): Resource<E, readonly [A, B]> => ({
		acquire: CoreTask.from.Promise((signal) =>
			Deferred.to.Promise(resourceA.acquire(signal)).then(async (acquiredA) => {
				if (Result.is.err(acquiredA)) {
					return acquiredA as Result<E, readonly [A, B]>;
				}
				const a = acquiredA.value;

				const acquiredB = await Deferred.to.Promise(resourceB.acquire(signal));
				if (Result.is.err(acquiredB)) {
					await Deferred.to.Promise(resourceA.release(a)(signal));
					return acquiredB as Result<E, readonly [A, B]>;
				}

				return Result.make.ok([a, acquiredB.value] as const);
			})
		),
		release: ([a, b]) =>
			CoreTask.from.Promise((signal) =>
				Deferred.to.Promise(resourceB.release(b)(signal)).then(() => Deferred.to.Promise(resourceA.release(a)(signal)))
			),
	});
}
