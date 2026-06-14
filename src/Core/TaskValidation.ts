import {
	Deferred,
	type Maybe,
	Maybe as CoreMaybe,
	type Result,
	type Task,
	Task as CoreTask,
	type Validation,
	Validation as CoreValidation,
} from "#core";
import { isNonEmptyArr, type NonEmptyArr, type Thenable } from "#internal";

/**
 * A Task that resolves to a Validation — combining async operations with
 * error accumulation. Unlike Task.Result, multiple failures are collected
 * rather than short-circuiting on the first error.
 *
 * @example
 * ```ts
 * const validateName = (name: string): Task.Validation<string, string> =>
 *   name.length > 0
 *     ? Task.Validation.passed(name)
 *     : Task.Validation.failed("Name is required");
 *
 * // Accumulate errors from multiple async validations using ap
 * pipe(
 *   Task.Validation.passed((name: string) => (age: number) => ({ name, age })),
 *   Task.Validation.ap(validateName("")),
 *   Task.Validation.ap(validateAge(-1))
 * )();
 * // Failed(["Name is required", "Age must be positive"])
 * ```
 */
export type TaskValidation<E, A> = Task<Validation<E, A>>;

export namespace TaskValidation {
	/**
	 * Wraps a value in a passed Task.Validation.
	 */
	export const passed = <E, A>(value: A): TaskValidation<E, A> => CoreTask.resolve(CoreValidation.make.passed(value));

	/**
	 * Creates a failed Task.Validation with a single error.
	 */
	export const failed = <E, A>(error: E): TaskValidation<E, A> => CoreTask.resolve(CoreValidation.make.failed(error));

	/**
	 * Creates a failed Task.Validation from multiple errors.
	 */
	export const failedAll = <E, A>(errors: NonEmptyArr<E>): TaskValidation<E, A> =>
		CoreTask.resolve(CoreValidation.make.failedAll(errors));

	// --- from ---
	export namespace from {
		/**
		 * Lifts a Validation into a Task.Validation.
		 */
		export const Validation = <E, A>(validation: Validation<E, A>): TaskValidation<E, A> => CoreTask.resolve(validation);

		/**
		 * Creates a Task.Validation from a nullable value.
		 * If the value is null or undefined, returns Failed with the error from onNull.
		 * Otherwise, returns Passed.
		 */
		export const nullable = <E>(onNull: () => E) => <A>(value: A | null | undefined): TaskValidation<E, A> =>
			CoreTask.resolve(
				value === null || value === undefined ? CoreValidation.make.failed(onNull()) : CoreValidation.make.passed(value),
			);

		/**
		 * Creates a Task.Validation from a Maybe.
		 * Some becomes Passed, None becomes Failed with the error from onNone.
		 */
		export const Maybe = <E>(onNone: () => E) => <A>(maybe: Maybe<A>): TaskValidation<E, A> =>
			CoreTask.resolve(
				CoreMaybe.is.none(maybe) ? CoreValidation.make.failed(onNone()) : CoreValidation.make.passed(maybe.value),
			);

		/**
		 * Creates a Task.Validation from a Result.
		 * Ok becomes Passed, Err(e) becomes Failed([e]).
		 */
		export const Result = <E, A>(result: Result<E, A>): TaskValidation<E, A> =>
			CoreTask.resolve(CoreValidation.from.Result(result));
	}

	/**
	 * Creates a Task.Validation from a Promise-returning function.
	 * Catches any errors and transforms them using the onError function.
	 * The factory optionally receives an `AbortSignal` forwarded from the call site.
	 *
	 * @example
	 * ```ts
	 * const fetchUser = (id: string): Task.Validation<string, User> =>
	 *   Task.Validation.tryCatch(
	 *     (signal) => fetch(`/users/${id}`, { signal }).then(r => r.json()),
	 *     e => `Failed to fetch user: ${e}`
	 *   );
	 * ```
	 */
	export const tryCatch = <E, A>(
		f: (signal?: AbortSignal) => Thenable<A>,
		onError: (e: unknown) => E,
	): TaskValidation<E, A> =>
		CoreTask.from.Promise((signal) =>
			Promise.resolve(f(signal)).then(CoreValidation.make.passed<E, A>).catch((error) =>
				CoreValidation.make.failed(onError(error))
			)
		);

	/**
	 * Transforms the success value inside a Task.Validation.
	 */
	export const map = <E, A, B>(f: (a: A) => B) => (data: TaskValidation<E, A>): TaskValidation<E, B> =>
		CoreTask.map(CoreValidation.map<A, B>(f))(data);

	/**
	 * Applies a function wrapped in a Task.Validation to a value wrapped in a
	 * Task.Validation. Both Tasks run in parallel and errors from both sides
	 * are accumulated.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Validation.passed((name: string) => (age: number) => ({ name, age })),
	 *   Task.Validation.ap(validateName(name)),
	 *   Task.Validation.ap(validateAge(age))
	 * )();
	 * ```
	 */
	export const ap =
		<E, A>(arg: TaskValidation<E, A>) => <B>(data: TaskValidation<E, (a: A) => B>): TaskValidation<E, B> =>
			CoreTask.from.Promise((signal) =>
				Promise.all([Deferred.to.Promise(data(signal)), Deferred.to.Promise(arg(signal))]).then(([vf, va]) =>
					CoreValidation.ap(va)(vf)
				)
			);

	/**
	 * Extracts a value from a Task.Validation by providing handlers for both cases.
	 */
	export const fold =
		<E, A, B>(onFailed: (errors: NonEmptyArr<E>) => B, onPassed: (a: A) => B) => (data: TaskValidation<E, A>): Task<B> =>
			CoreTask.map(CoreValidation.fold<E, A, B>(onFailed, onPassed))(data);

	/**
	 * Pattern matches on a Task.Validation, returning a Task of the result.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   validateForm(input),
	 *   Task.Validation.match({
	 *     passed: data => save(data),
	 *     failed: errors => showErrors(errors)
	 *   })
	 * )();
	 * ```
	 */
	export const match =
		<E, A, B>(cases: { passed: (a: A) => B; failed: (errors: NonEmptyArr<E>) => B; }) =>
		(data: TaskValidation<E, A>): Task<B> => CoreTask.map(CoreValidation.match<E, A, B>(cases))(data);

	/**
	 * Returns the success value or a default value if the Task.Validation is failed.
	 * The default can be a different type, widening the result to `Task<A | B>`.
	 */
	export const getOrElse = <E, A, B>(defaultValue: () => B) => (data: TaskValidation<E, A>): Task<A | B> =>
		CoreTask.map(CoreValidation.getOrElse<E, A, B>(defaultValue))(data);

	/**
	 * Executes a side effect on the success value without changing the Task.Validation.
	 * Useful for logging or debugging.
	 */
	export const tap = <E, A>(f: (a: A) => void) => (data: TaskValidation<E, A>): TaskValidation<E, A> =>
		CoreTask.map(CoreValidation.tap<E, A>(f))(data);

	/**
	 * Recovers from a Failed state by providing a fallback Task.Validation.
	 * The fallback receives the accumulated error list so callers can inspect which errors occurred.
	 * The fallback can produce a different success type, widening the result to `Task.Validation<E, A | B>`.
	 */
	export const recover =
		<E, A, B>(fallback: (errors: NonEmptyArr<E>) => TaskValidation<E, B>) =>
		(data: TaskValidation<E, A>): TaskValidation<E, A | B> =>
			CoreTask.chain((validation: Validation<E, A>) =>
				CoreValidation.is.passed(validation)
					? CoreTask.resolve(validation as Validation<E, A | B>)
					: fallback(validation.errors)
			)(data);

	/**
	 * Runs two Task.Validations concurrently and combines their results into a tuple.
	 * If both are Passed, returns Passed with both values. If either fails, accumulates
	 * errors from both sides.
	 *
	 * @example
	 * ```ts
	 * await Task.Validation.product(
	 *   validateName(form.name),
	 *   validateAge(form.age),
	 * )(); // Passed(["Alice", 30]) or Failed([...errors])
	 * ```
	 */
	export const product = <E, A, B>(
		first: TaskValidation<E, A>,
		second: TaskValidation<E, B>,
	): TaskValidation<E, readonly [A, B]> =>
		CoreTask.from.Promise((signal) =>
			Promise.all([Deferred.to.Promise(first(signal)), Deferred.to.Promise(second(signal))]).then(([va, vb]) =>
				CoreValidation.product(va, vb)
			)
		);

	/**
	 * Runs all Task.Validations concurrently and collects results.
	 * If all are Passed, returns Passed with all values as an array.
	 * If any fail, returns Failed with all accumulated errors.
	 *
	 * @example
	 * ```ts
	 * await Task.Validation.productAll([
	 *   validateName(form.name),
	 *   validateEmail(form.email),
	 *   validateAge(form.age),
	 * ])(); // Passed([name, email, age]) or Failed([...all errors])
	 * ```
	 */
	export const productAll = <E, A>(data: NonEmptyArr<TaskValidation<E, A>>): TaskValidation<E, readonly A[]> =>
		CoreTask.from.Promise((signal) =>
			Promise.all(data.map((t) => Deferred.to.Promise(t(signal)))).then((results) => {
				const [first, ...rest] = results;
				return CoreValidation.productAll([first!, ...rest]);
			})
		);

	/**
	 * Transforms all accumulated errors inside a Task.Validation.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Validation.failed("oops"),
	 *   Task.Validation.mapError(e => e.toUpperCase())
	 * ); // Task.Validation(Failed(["OOPS"]))
	 * ```
	 */
	export const mapError = <E, F, A>(f: (e: E) => F) => (data: TaskValidation<E, A>): TaskValidation<F, A> =>
		CoreTask.map(CoreValidation.mapError<E, F, A>(f))(data);

	/**
	 * Executes a side effect on the accumulated errors without changing the Task.Validation.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Validation.failed("invalid name"),
	 *   Task.Validation.tapError(errs => logger.error(errs))
	 * );
	 * ```
	 */
	export const tapError =
		<E, A>(f: (errors: NonEmptyArr<E>) => void) => (data: TaskValidation<E, A>): TaskValidation<E, A> =>
			CoreTask.map(CoreValidation.tapError<E, A>(f))(data);

	/**
	 * Combines a record of Task.Validations into a single Task.Validation of a record.
	 * Evaluates fields in parallel and accumulates all validation errors.
	 *
	 * @example
	 * ```ts
	 * Task.Validation.struct({
	 *   name: Task.Validation.passed("Alice"),
	 *   age: Task.Validation.passed(30)
	 * }); // Task.Validation({ name: "Alice", age: 30 })
	 * ```
	 */
	export const struct = <E, R extends Record<string, any>>(
		fields: { [K in keyof R]: TaskValidation<E, R[K]>; },
	): TaskValidation<E, R> =>
		CoreTask.from.Promise((signal) => {
			const keys = Object.keys(fields);
			const promises = keys.map((key) => Deferred.to.Promise(fields[key](signal)));
			return Promise.all(promises).then((results) => {
				const record = {} as R;
				const errors: E[] = [];
				for (let i = 0; i < keys.length; i++) {
					const res = results[i] as Validation<E, any>;
					if (CoreValidation.is.passed(res)) {
						record[keys[i] as keyof R] = res.value;
					} else {
						errors.push(...res.errors);
					}
				}
				return isNonEmptyArr(errors) ? CoreValidation.make.failedAll(errors) : CoreValidation.make.passed(record);
			});
		});
}
