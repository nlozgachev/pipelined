import { Deferred } from "./Deferred.ts";
import { Result } from "./Result.ts";
import { Task } from "./Task.ts";
import { TaskResult } from "./TaskResult.ts";

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
 * Build a Resource with `Resource.make` or `Resource.fromTask`, then run it
 * with `Resource.use`.
 *
 * @example
 * ```ts
 * const dbResource = Resource.make(
 *   TaskResult.tryCatch(() => openConnection(config), (e) => new DbError(e)),
 *   (conn) => Task.from(() => conn.close())
 * );
 *
 * const result = await pipe(
 *   dbResource,
 *   Resource.use((conn) => queryUser(conn, userId))
 * )();
 * // conn.close() is called whether queryUser succeeds or fails
 * ```
 */
export type Resource<E, A> = {
	readonly acquire: TaskResult<E, A>;
	readonly release: (a: A) => Task<void>;
};

export namespace Resource {
	/**
	 * Creates a Resource from an acquire operation that may fail and a release function.
	 *
	 * @example
	 * ```ts
	 * const fileResource = Resource.make(
	 *   TaskResult.tryCatch(() => fs.promises.open("data.csv", "r"), toFileError),
	 *   (handle) => Task.from(() => handle.close())
	 * );
	 * ```
	 */
	export const make = <E, A>(
		acquire: TaskResult<E, A>,
		release: (a: A) => Task<void>,
	): Resource<E, A> => ({ acquire, release });

	/**
	 * Creates a Resource from an acquire operation that cannot fail.
	 * Use this when opening the resource is guaranteed to succeed, such as
	 * in-memory locks, counters, or timers.
	 *
	 * @example
	 * ```ts
	 * const timerResource = Resource.fromTask<never, Timer>(
	 *   Task.from(() => Promise.resolve(startTimer())),
	 *   (timer) => Task.from(() => Promise.resolve(timer.stop()))
	 * );
	 * ```
	 */
	export const fromTask = <E, A>(
		acquire: Task<A>,
		release: (a: A) => Task<void>,
	): Resource<E, A> => ({
		acquire: Task.map((a: A): Result<E, A> => Result.ok(a))(acquire),
		release,
	});

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
	export const use = <E, A, B>(f: (a: A) => TaskResult<E, B>) => (resource: Resource<E, A>): TaskResult<E, B> =>
		Task.from(() =>
			Deferred.toPromise(resource.acquire()).then(async (acquired) => {
				if (Result.isErr(acquired)) return acquired as Result<E, B>;
				const a = acquired.value;
				const usageResult = await Deferred.toPromise(f(a)());
				await Deferred.toPromise(resource.release(a)());
				return usageResult;
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
		acquire: Task.from(() =>
			Deferred.toPromise(resourceA.acquire()).then(async (acquiredA) => {
				if (Result.isErr(acquiredA)) return acquiredA as Result<E, readonly [A, B]>;
				const a = acquiredA.value;

				const acquiredB = await Deferred.toPromise(resourceB.acquire());
				if (Result.isErr(acquiredB)) {
					await Deferred.toPromise(resourceA.release(a)());
					return acquiredB as Result<E, readonly [A, B]>;
				}

				return Result.ok([a, acquiredB.value] as const);
			})
		),
		release: ([a, b]) =>
			Task.from(() => Deferred.toPromise(resourceB.release(b)()).then(() => Deferred.toPromise(resourceA.release(a)()))),
	});
}
