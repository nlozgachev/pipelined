import { Deferred } from "./Deferred.ts";
import { Result } from "./Result.ts";
import { type Task, Task as CoreTask } from "./Task.ts";

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
 * Build a Resource with `Resource.make` or `Resource.from.Task`, then run it
 * with `Resource.use`.
 *
 * @example
 * ```ts
 * const dbResource = Resource.make(
 *   Task.Result.tryCatch(() => openConnection(config), { onError: (e) => new DbError(e) }),
 *   (conn) => Task.tryCatch(() => conn.close(), { onError: () => {} })
 * );
 *
 * const result = await pipe(
 *   dbResource,
 *   Resource.use((conn) => queryUser(conn, userId))
 * )();
 * // conn.close() is called whether queryUser succeeds or fails
 * ```
 */
export type Resource<E, A> = { readonly acquire: Task.Result<E, A>; readonly release: (value: A) => Task<void>; };

const makeResource = <E, A>(acquire: Task.Result<E, A>, release: (value: A) => Task<void>): Resource<E, A> => ({
	acquire,
	release,
});

const makeTask = <A, E = never>(acquire: Task<A>, release: (value: A) => Task<void>): Resource<E, A> => ({
	acquire: CoreTask.map((value: A): Result<E, A> => Result.make.ok(value))(acquire),
	release,
});

const use =
	<A, E2, B>(consume: (value: A) => Task.Result<E2, B>) =>
	<E1 = never>(resource: Resource<E1, A>): Task.Result<E1 | E2, B> =>
	(signal) =>
		Deferred.from.Promise(
			Deferred.to.Promise(resource.acquire(signal)).then(async (acquired) => {
				if (Result.is.err(acquired)) {
					return acquired as Result<E1 | E2, B>;
				}
				const resourceValue = acquired.value;
				try {
					return await Deferred.to.Promise(consume(resourceValue)(signal));
				} finally {
					await Deferred.to.Promise(resource.release(resourceValue)(signal));
				}
			}),
		);

const combine = <E1, A, E2, B>(
	resourceA: Resource<E1, A>,
	resourceB: Resource<E2, B>,
): Resource<E1 | E2, readonly [A, B]> => ({
	acquire: (signal) =>
		Deferred.from.Promise(
			Deferred.to.Promise(resourceA.acquire(signal)).then(async (acquiredA) => {
				if (Result.is.err(acquiredA)) {
					return acquiredA as Result<E1 | E2, readonly [A, B]>;
				}
				const valueA = acquiredA.value;

				const acquiredB = await Deferred.to.Promise(resourceB.acquire(signal));
				if (Result.is.err(acquiredB)) {
					await Deferred.to.Promise(resourceA.release(valueA)(signal));
					return acquiredB as Result<E1 | E2, readonly [A, B]>;
				}

				return Result.make.ok([valueA, acquiredB.value] as const);
			}),
		),
	release: ([valueA, valueB]) => (signal) =>
		Deferred.from.Promise((async () => {
			try {
				await Deferred.to.Promise(resourceB.release(valueB)(signal));
			} finally {
				await Deferred.to.Promise(resourceA.release(valueA)(signal));
			}
		})()),
});

export const Resource = {
	/**
	 * Creates a Resource from an acquire operation that may fail and a release function.
	 *
	 * @example
	 * ```ts
	 * const fileResource = Resource.make(
	 *   Task.Result.tryCatch(() => fs.promises.open("data.csv", "r"), { onError: toFileError }),
	 *   (handle) => Task.tryCatch(() => handle.close(), { onError: () => {} })
	 * );
	 * ```
	 */
	make: makeResource,

	// --- from ---
	from: {
		/**
		 * Creates a Resource from an acquire operation that cannot fail.
		 * Use this when opening the resource is guaranteed to succeed, such as
		 * in-memory locks, counters, or timers.
		 *
		 * @example
		 * ```ts
		 * const timerResource = Resource.from.Task(
		 *   Task.tryCatch(() => Promise.resolve(startTimer()), { onError: () => defaultTimer }),
		 *   (timer) => Task.tryCatch(() => Promise.resolve(timer.stop()), { onError: () => {} })
		 * );
		 * ```
		 */
		Task: makeTask,
	},

	/**
	 * Acquires the resource, runs `consume` with it, then releases it.
	 *
	 * Release always runs, even when `consume` returns an error or throws.
	 * If acquire fails, `consume` and release are both skipped and the error is returned.
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
	use,

	/**
	 * Acquires two resources in sequence and presents them as a tuple.
	 * Resources are released in reverse order: the second is released before the first.
	 *
	 * If the second resource fails to acquire or throws, the first is released immediately
	 * before propagating the error. If releasing the second resource fails, the first
	 * resource is still guaranteed to be released.
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
	combine,
};
