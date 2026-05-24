import { Deferred, Maybe, Result, Task, Validation } from "#core";
import { NonEmptyList } from "#types";

/**
 * A Task that resolves to a Validation — combining async operations with
 * error accumulation. Unlike TaskResult, multiple failures are collected
 * rather than short-circuiting on the first error.
 *
 * @example
 * ```ts
 * const validateName = (name: string): TaskValidation<string, string> =>
 *   name.length > 0
 *     ? TaskValidation.passed(name)
 *     : TaskValidation.failed("Name is required");
 *
 * // Accumulate errors from multiple async validations using ap
 * pipe(
 *   TaskValidation.passed((name: string) => (age: number) => ({ name, age })),
 *   TaskValidation.ap(validateName("")),
 *   TaskValidation.ap(validateAge(-1))
 * )();
 * // Failed(["Name is required", "Age must be positive"])
 * ```
 */
export type TaskValidation<E, A> = Task<Validation<E, A>>;

export namespace TaskValidation {
	/**
	 * Wraps a value in a passed TaskValidation.
	 */
	export const passed = <E, A>(value: A): TaskValidation<E, A> => Task.resolve(Validation.passed(value));

	/**
	 * Creates a failed TaskValidation with a single error.
	 */
	export const failed = <E, A>(error: E): TaskValidation<E, A> => Task.resolve(Validation.failed(error));

	/**
	 * Creates a failed TaskValidation from multiple errors.
	 */
	export const failedAll = <E, A>(errors: NonEmptyList<E>): TaskValidation<E, A> =>
		Task.resolve(Validation.failedAll(errors));

	/**
	 * Lifts a Validation into a TaskValidation.
	 */
	export const fromValidation = <E, A>(validation: Validation<E, A>): TaskValidation<E, A> => Task.resolve(validation);

	/**
	 * Creates a TaskValidation from a nullable value.
	 * If the value is null or undefined, returns Failed with the error from onNull.
	 * Otherwise, returns Passed.
	 */
	export const fromNullable = <E>(onNull: () => E) => <A>(value: A | null | undefined): TaskValidation<E, A> =>
		Task.resolve(value === null || value === undefined ? Validation.failed(onNull()) : Validation.passed(value));

	/**
	 * Creates a TaskValidation from a Maybe.
	 * Some becomes Passed, None becomes Failed with the error from onNone.
	 */
	export const fromMaybe = <E>(onNone: () => E) => <A>(maybe: Maybe<A>): TaskValidation<E, A> =>
		Task.resolve(Maybe.isNone(maybe) ? Validation.failed(onNone()) : Validation.passed(maybe.value));

	/**
	 * Creates a TaskValidation from a Result.
	 * Ok becomes Passed, Err(e) becomes Failed([e]).
	 */
	export const fromResult = <E, A>(result: Result<E, A>): TaskValidation<E, A> =>
		Task.resolve(Validation.fromResult(result));

	/**
	 * Creates a TaskValidation from a Promise-returning function.
	 * Catches any errors and transforms them using the onError function.
	 * The factory optionally receives an `AbortSignal` forwarded from the call site.
	 *
	 * @example
	 * ```ts
	 * const fetchUser = (id: string): TaskValidation<string, User> =>
	 *   TaskValidation.tryCatch(
	 *     (signal) => fetch(`/users/${id}`, { signal }).then(r => r.json()),
	 *     e => `Failed to fetch user: ${e}`
	 *   );
	 * ```
	 */
	export const tryCatch = <E, A>(
		f: (signal?: AbortSignal) => Promise<A>,
		onError: (e: unknown) => E,
	): TaskValidation<E, A> =>
		Task.from((signal) => f(signal).then(Validation.passed<E, A>).catch((error) => Validation.failed(onError(error))));

	/**
	 * Transforms the success value inside a TaskValidation.
	 */
	export const map = <E, A, B>(f: (a: A) => B) => (data: TaskValidation<E, A>): TaskValidation<E, B> =>
		Task.map(Validation.map<A, B>(f))(data);

	/**
	 * Applies a function wrapped in a TaskValidation to a value wrapped in a
	 * TaskValidation. Both Tasks run in parallel and errors from both sides
	 * are accumulated.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   TaskValidation.passed((name: string) => (age: number) => ({ name, age })),
	 *   TaskValidation.ap(validateName(name)),
	 *   TaskValidation.ap(validateAge(age))
	 * )();
	 * ```
	 */
	export const ap =
		<E, A>(arg: TaskValidation<E, A>) => <B>(data: TaskValidation<E, (a: A) => B>): TaskValidation<E, B> =>
			Task.from((signal) =>
				Promise.all([Deferred.toPromise(data(signal)), Deferred.toPromise(arg(signal))]).then(([vf, va]) =>
					Validation.ap(va)(vf)
				)
			);

	/**
	 * Extracts a value from a TaskValidation by providing handlers for both cases.
	 */
	export const fold =
		<E, A, B>(onFailed: (errors: NonEmptyList<E>) => B, onPassed: (a: A) => B) => (data: TaskValidation<E, A>): Task<B> =>
			Task.map(Validation.fold<E, A, B>(onFailed, onPassed))(data);

	/**
	 * Pattern matches on a TaskValidation, returning a Task of the result.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   validateForm(input),
	 *   TaskValidation.match({
	 *     passed: data => save(data),
	 *     failed: errors => showErrors(errors)
	 *   })
	 * )();
	 * ```
	 */
	export const match =
		<E, A, B>(cases: { passed: (a: A) => B; failed: (errors: NonEmptyList<E>) => B; }) =>
		(data: TaskValidation<E, A>): Task<B> => Task.map(Validation.match<E, A, B>(cases))(data);

	/**
	 * Returns the success value or a default value if the TaskValidation is failed.
	 * The default can be a different type, widening the result to `Task<A | B>`.
	 */
	export const getOrElse = <E, A, B>(defaultValue: () => B) => (data: TaskValidation<E, A>): Task<A | B> =>
		Task.map(Validation.getOrElse<E, A, B>(defaultValue))(data);

	/**
	 * Executes a side effect on the success value without changing the TaskValidation.
	 * Useful for logging or debugging.
	 */
	export const tap = <E, A>(f: (a: A) => void) => (data: TaskValidation<E, A>): TaskValidation<E, A> =>
		Task.map(Validation.tap<E, A>(f))(data);

	/**
	 * Recovers from a Failed state by providing a fallback TaskValidation.
	 * The fallback receives the accumulated error list so callers can inspect which errors occurred.
	 * The fallback can produce a different success type, widening the result to `TaskValidation<E, A | B>`.
	 */
	export const recover =
		<E, A, B>(fallback: (errors: NonEmptyList<E>) => TaskValidation<E, B>) =>
		(data: TaskValidation<E, A>): TaskValidation<E, A | B> =>
			Task.chain((validation: Validation<E, A>) =>
				Validation.isPassed(validation) ? Task.resolve(validation as Validation<E, A | B>) : fallback(validation.errors)
			)(data);

	/**
	 * Runs two TaskValidations concurrently and combines their results into a tuple.
	 * If both are Passed, returns Passed with both values. If either fails, accumulates
	 * errors from both sides.
	 *
	 * @example
	 * ```ts
	 * await TaskValidation.product(
	 *   validateName(form.name),
	 *   validateAge(form.age),
	 * )(); // Passed(["Alice", 30]) or Failed([...errors])
	 * ```
	 */
	export const product = <E, A, B>(
		first: TaskValidation<E, A>,
		second: TaskValidation<E, B>,
	): TaskValidation<E, readonly [A, B]> =>
		Task.from((signal) =>
			Promise.all([Deferred.toPromise(first(signal)), Deferred.toPromise(second(signal))]).then(([va, vb]) =>
				Validation.product(va, vb)
			)
		);

	/**
	 * Runs all TaskValidations concurrently and collects results.
	 * If all are Passed, returns Passed with all values as an array.
	 * If any fail, returns Failed with all accumulated errors.
	 *
	 * @example
	 * ```ts
	 * await TaskValidation.productAll([
	 *   validateName(form.name),
	 *   validateEmail(form.email),
	 *   validateAge(form.age),
	 * ])(); // Passed([name, email, age]) or Failed([...all errors])
	 * ```
	 */
	export const productAll = <E, A>(data: NonEmptyList<TaskValidation<E, A>>): TaskValidation<E, readonly A[]> =>
		Task.from((signal) =>
			Promise.all(data.map((t) => Deferred.toPromise(t(signal)))).then((results) =>
				Validation.productAll(results as unknown as NonEmptyList<Validation<E, A>>)
			)
		);
}
