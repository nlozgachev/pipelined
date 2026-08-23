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
import type { TaskMaybe } from "./TaskMaybe.ts";
import type { TaskResult } from "./TaskResult.ts";

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

const makePassed = <E = never, A = unknown>(value: A): TaskValidation<E, A> =>
	CoreTask.resolve(CoreValidation.make.passed(value));

const makeFailed = <E, A = never>(error: E): TaskValidation<E, A> =>
	CoreTask.resolve(CoreValidation.make.failed(error));

const makeFailedAll = <E, A = never>(errors: NonEmptyArr<E>): TaskValidation<E, A> =>
	CoreTask.resolve(CoreValidation.make.failedAll(errors));

export const TaskValidation = {
	make: {
		/**
		 * Wraps a value in a passed Task.Validation.
		 *
		 * @example
		 * ```ts
		 * const task = Task.Validation.make.passed(42);
		 * const res = await task(); // Passed(42)
		 * ```
		 */
		passed: makePassed,

		/**
		 * Creates a failed Task.Validation with a single error.
		 *
		 * @example
		 * ```ts
		 * const task = Task.Validation.make.failed("invalid");
		 * const res = await task(); // Failed(["invalid"])
		 * ```
		 */
		failed: makeFailed,

		/**
		 * Creates a failed Task.Validation from multiple errors.
		 *
		 * @example
		 * ```ts
		 * const task = Task.Validation.make.failedAll(["err1", "err2"]);
		 * const res = await task(); // Failed(["err1", "err2"])
		 * ```
		 */
		failedAll: makeFailedAll,
	},

	passed: makePassed,
	failed: makeFailed,
	failedAll: makeFailedAll,

	// --- from ---
	from: {
		/**
		 * Lifts a Validation into a Task.Validation.
		 *
		 * @example
		 * ```ts
		 * Task.Validation.from.Validation(Validation.make.passed(42));
		 * ```
		 */
		Validation: <E, A>(validation: Validation<E, A>): TaskValidation<E, A> => CoreTask.resolve(validation),

		/**
		 * Creates a Task.Validation from a nullable value.
		 * If the value is null or undefined, returns Failed with the error from onNull.
		 * Otherwise, returns Passed.
		 *
		 * @example
		 * ```ts
		 * Task.Validation.from.nullable(() => "missing")(42);   // resolves to Passed(42)
		 * Task.Validation.from.nullable(() => "missing")(null); // resolves to Failed(["missing"])
		 * ```
		 */
		nullable: <E>(onNull: () => E) => <A>(value: A | null | undefined): TaskValidation<E, A> =>
			CoreTask.resolve(
				value === null || value === undefined ? CoreValidation.make.failed(onNull()) : CoreValidation.make.passed(value),
			),

		/**
		 * Creates a Task.Validation from a Maybe.
		 * Some becomes Passed, None becomes Failed with the error from onNone.
		 *
		 * @example
		 * ```ts
		 * Task.Validation.from.Maybe(() => "empty")(Maybe.make.some(42)); // resolves to Passed(42)
		 * Task.Validation.from.Maybe(() => "empty")(Maybe.make.none());   // resolves to Failed(["empty"])
		 * ```
		 */
		Maybe: <E>(onNone: () => E) => <A>(maybe: Maybe<A>): TaskValidation<E, A> =>
			CoreTask.resolve(
				CoreMaybe.is.none(maybe) ? CoreValidation.make.failed(onNone()) : CoreValidation.make.passed(maybe.value),
			),

		/**
		 * Creates a Task.Validation from a Result.
		 * Ok becomes Passed, Err(e) becomes Failed([e]).
		 *
		 * @example
		 * ```ts
		 * Task.Validation.from.Result(Result.make.ok(42));     // resolves to Passed(42)
		 * Task.Validation.from.Result(Result.make.err("bad")); // resolves to Failed(["bad"])
		 * ```
		 */
		Result: <E, A>(result: Result<E, A>): TaskValidation<E, A> => CoreTask.resolve(CoreValidation.from.Result(result)),
	},

	// --- to ---
	to: {
		/**
		 * Converts a `Task.Validation` to a `Task.Result`, combining accumulated errors using `combineErrors`.
		 * `Passed(a)` becomes `Ok(a)`; `Failed(errors)` becomes `Err(combineErrors(errors))`.
		 *
		 * @example
		 * ```ts
		 * Task.Validation.to.Result((errors) => errors.join(", "))(validationTask);
		 * ```
		 */
		Result:
			<E1, E2, A>(combineErrors: (errors: NonEmptyArr<E1>) => E2) => (data: TaskValidation<E1, A>): TaskResult<E2, A> =>
				CoreTask.map(CoreValidation.to.Result<E1, E2, A>(combineErrors))(data),

		/**
		 * Converts a `Task.Validation` to a `Task.Maybe`.
		 * `Passed(a)` becomes `Some(a)`; `Failed(errors)` becomes `None` (errors are discarded).
		 *
		 * @example
		 * ```ts
		 * Task.Validation.to.Maybe(validationTask);
		 * ```
		 */
		Maybe: <E, A>(data: TaskValidation<E, A>): TaskMaybe<A> => CoreTask.map(CoreValidation.to.Maybe<E, A>)(data),
	},

	/**
	 * Creates a Task.Validation from a Promise-returning thunk that may throw or reject.
	 * Catches any errors and transforms them using the `onError` function into a Failed validation.
	 * The thunk optionally receives an `AbortSignal` forwarded from the call site.
	 *
	 * @example
	 * ```ts
	 * const loadConfig = Task.Validation.tryCatch(
	 *   (signal) => configStore.get("default", { signal }),
	 *   { onError: (e) => `Failed to load config: ${e}` }
	 * );
	 * ```
	 */
	tryCatch:
		<E, A>(
			f: (signal?: AbortSignal) => Thenable<A>,
			options: { onError: (error: unknown) => E; },
		): TaskValidation<E, A> =>
		(signal) =>
			Deferred.from.Promise(
				// oxlint-disable-next-line require-await
				globalThis.Promise.resolve().then(async () => f(signal)).then(CoreValidation.make.passed<E, A>).catch((error) =>
					CoreValidation.make.failed<E>(options.onError(error))
				),
			),

	/**
	 * Transforms the success value inside a Task.Validation.
	 */
	map: <E, A, B>(f: (a: A) => B) => (data: TaskValidation<E, A>): TaskValidation<E, B> =>
		CoreTask.map(CoreValidation.map<A, B>(f))(data),

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
	ap: <E, A>(arg: TaskValidation<E, A>) => <B>(data: TaskValidation<E, (a: A) => B>): TaskValidation<E, B> => (signal) =>
		Deferred.from.Promise(
			Promise.all([Deferred.to.Promise(data(signal)), Deferred.to.Promise(arg(signal))]).then(([vf, va]) =>
				CoreValidation.ap(va)(vf)
			),
		),

	/**
	 * Extracts a value from a Task.Validation by providing handlers for both cases.
	 */
	fold:
		<E, A, B>(onFailed: (errors: NonEmptyArr<E>) => B, onPassed: (a: A) => B) => (data: TaskValidation<E, A>): Task<B> =>
			CoreTask.map(CoreValidation.fold<E, A, B>(onFailed, onPassed))(data),

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
	match:
		<E, A, B>(cases: { passed: (a: A) => B; failed: (errors: NonEmptyArr<E>) => B; }) =>
		(data: TaskValidation<E, A>): Task<B> => CoreTask.map(CoreValidation.match<E, A, B>(cases))(data),

	/**
	 * Returns the success value or a default value if the Task.Validation is failed.
	 * The default can be a different type, widening the result to `Task<A | B>`.
	 */
	getOrElse: <B>(defaultValue: () => B) => <E, A>(data: TaskValidation<E, A>): Task<A | B> =>
		CoreTask.map(CoreValidation.getOrElse<B>(defaultValue))(data),

	/**
	 * Executes a side effect on the success value without changing the Task.Validation.
	 * Useful for logging or debugging.
	 */
	tap: <E, A>(f: (a: A) => void) => (data: TaskValidation<E, A>): TaskValidation<E, A> =>
		CoreTask.map(CoreValidation.tap<E, A>(f))(data),

	/**
	 * Recovers from a Failed state by providing a fallback Task.Validation.
	 * The fallback receives the accumulated error list so callers can inspect which errors occurred.
	 * The fallback can produce a different success type, widening the result to `Task.Validation<E, A | B>`.
	 */
	recover:
		<E, B>(fallback: (errors: NonEmptyArr<E>) => TaskValidation<E, B>) =>
		<A>(data: TaskValidation<E, A>): TaskValidation<E, A | B> =>
			CoreTask.chain((validation: Validation<E, A>) =>
				CoreValidation.is.passed(validation)
					? CoreTask.resolve(validation as Validation<E, A | B>)
					: fallback(validation.errors)
			)(data),

	/**
	 * Recovers from a Failed state unless the predicate `isBlocked` returns true for the accumulated errors.
	 * The fallback receives the accumulated errors and can produce a different success type, widening the result to `Task.Validation<E, A | B>`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   validationTask,
	 *   Task.Validation.recoverUnless(
	 *     (errors) => errors.includes("fatal"),
	 *     (errors) => Task.Validation.passed("fallback")
	 *   )
	 * );
	 * ```
	 */
	recoverUnless:
		<E, B>(isBlocked: (errors: NonEmptyArr<E>) => boolean, fallback: (errors: NonEmptyArr<E>) => TaskValidation<E, B>) =>
		<A>(data: TaskValidation<E, A>): TaskValidation<E, A | B> =>
			CoreTask.chain((validation: Validation<E, A>) =>
				CoreValidation.is.passed(validation)
					? CoreTask.resolve(validation as Validation<E, A | B>)
					: isBlocked(validation.errors)
					? CoreTask.resolve(validation as Validation<E, A | B>)
					: fallback(validation.errors)
			)(data),

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
	product:
		<E, A, B>(first: TaskValidation<E, A>, second: TaskValidation<E, B>): TaskValidation<E, readonly [A, B]> =>
		(signal) =>
			Deferred.from.Promise(
				Promise.all([Deferred.to.Promise(first(signal)), Deferred.to.Promise(second(signal))]).then(([va, vb]) =>
					CoreValidation.product(va, vb)
				),
			),

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
	productAll: <E, A>(data: NonEmptyArr<TaskValidation<E, A>>): TaskValidation<E, readonly A[]> => (signal) =>
		Deferred.from.Promise(
			Promise.all(data.map((t) => Deferred.to.Promise(t(signal)))).then((results) => {
				const [first, ...rest] = results;
				return CoreValidation.productAll([first!, ...rest]);
			}),
		),

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
	mapError: <E, F, A>(f: (e: E) => F) => (data: TaskValidation<E, A>): TaskValidation<F, A> =>
		CoreTask.map(CoreValidation.mapError<E, F, A>(f))(data),

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
	tapError: <E, A>(f: (errors: NonEmptyArr<E>) => void) => (data: TaskValidation<E, A>): TaskValidation<E, A> =>
		CoreTask.map(CoreValidation.tapError<E, A>(f))(data),

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
	struct:
		<E, R extends Record<string, any>>(fields: { [K in keyof R]: TaskValidation<E, R[K]>; }): TaskValidation<E, R> =>
		(signal) =>
			Deferred.from.Promise((() => {
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
			})()),

	/**
	 * Creates a memoized version of a Task.Validation. The task is executed at most once on first call,
	 * and its resolved Validation is cached for all subsequent calls.
	 *
	 * @example
	 * ```ts
	 * const validate = Task.Validation.memoize(validateFormTask);
	 * ```
	 */
	memoize: <E, A>(task: TaskValidation<E, A>): TaskValidation<E, A> => CoreTask.memoize(task),
};
