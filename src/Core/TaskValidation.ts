import { isNonEmptyArr, type NonEmptyArr, type Thenable } from "#internal";
import { Deferred } from "./Deferred.ts";
import { type Maybe, Maybe as CoreMaybe } from "./Maybe.ts";
import { type Result } from "./Result.ts";
import { Task } from "./Task.ts";
import { type Validation, Validation as CoreValidation } from "./Validation.ts";

const makePassed = <E = never, A = unknown>(value: A): Task.Validation<E, A> =>
	Task.make(CoreValidation.make.passed(value));

const makeFailed = <E, A = never>(error: E): Task.Validation<E, A> => Task.make(CoreValidation.make.failed(error));

const makeFailedAll = <E, A = never>(errors: NonEmptyArr<E>): Task.Validation<E, A> =>
	Task.make(CoreValidation.make.failedAll(errors));

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
		Validation: <E, A>(validation: Validation<E, A>): Task.Validation<E, A> => Task.make(validation),

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
		nullable: <E>(onNull: () => E) => <A>(value: A | null | undefined): Task.Validation<E, A> =>
			Task.make(
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
		Maybe: <E>(onNone: () => E) => <A>(maybe: Maybe<A>): Task.Validation<E, A> =>
			Task.make(CoreMaybe.is.none(maybe) ? CoreValidation.make.failed(onNone()) : CoreValidation.make.passed(maybe.value)),

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
		Result: <E, A>(result: Result<E, A>): Task.Validation<E, A> => Task.make(CoreValidation.from.Result(result)),
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
			<E1, E2, A>(combineErrors: (errors: NonEmptyArr<E1>) => E2) => (task: Task.Validation<E1, A>): Task.Result<E2, A> =>
				Task.map(CoreValidation.to.Result<E1, E2, A>(combineErrors))(task),

		/**
		 * Converts a `Task.Validation` to a `Task.Maybe`.
		 * `Passed(a)` becomes `Some(a)`; `Failed(errors)` becomes `None` (errors are discarded).
		 *
		 * @example
		 * ```ts
		 * Task.Validation.to.Maybe(validationTask);
		 * ```
		 */
		Maybe: <E, A>(task: Task.Validation<E, A>): Task.Maybe<A> => Task.map(CoreValidation.to.Maybe<E, A>)(task),
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
			fn: (signal?: AbortSignal) => Thenable<A>,
			options: { onError: (error: unknown) => E; },
		): Task.Validation<E, A> =>
		(signal) =>
			Deferred.from.Promise(
				// oxlint-disable-next-line require-await
				globalThis.Promise.resolve().then(async () => fn(signal)).then(CoreValidation.make.passed<E, A>).catch((error) =>
					CoreValidation.make.failed<E>(options.onError(error))
				),
			),

	/**
	 * Transforms the success value inside a Task.Validation.
	 *
	 * @see {@link Task.Validation.mapError} to transform accumulated errors.
	 * @see {@link Task.Validation.apply} to combine multiple validations in parallel.
	 */
	map: <E, A, B>(transform: (value: A) => B) => (task: Task.Validation<E, A>): Task.Validation<E, B> =>
		Task.map(CoreValidation.map<A, B>(transform))(task),

	/**
	 * Applies a function wrapped in a Task.Validation to a value wrapped in a
	 * Task.Validation. Both Tasks run in parallel and errors from both sides
	 * are accumulated.
	 *
	 * @see {@link Task.Validation.product} to combine two validations into a tuple.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Validation.make.passed((name: string) => (age: number) => ({ name, age })),
	 *   Task.Validation.apply(validateName(name)),
	 *   Task.Validation.apply(validateAge(age))
	 * )();
	 * ```
	 */
	apply:
		<E2, A>(arg: Task.Validation<E2, A>) =>
		<B, E1 = never>(task: Task.Validation<E1, (value: A) => B>): Task.Validation<E1 | E2, B> =>
		(signal) =>
			Deferred.from.Promise(
				Promise.all([Deferred.to.Promise(task(signal)), Deferred.to.Promise(arg(signal))]).then(([vf, va]) =>
					CoreValidation.apply(va)(vf)
				),
			),

	/**
	 * Extracts a value from a Task.Validation by providing handlers for both cases.
	 *
	 * @see {@link Task.Validation.match} for named-case pattern matching with an object literal.
	 */
	fold:
		<E, A, B>(onFailed: (errors: NonEmptyArr<E>) => B, onPassed: (value: A) => B) =>
		(task: Task.Validation<E, A>): Task<B> => Task.map(CoreValidation.fold<E, A, B>(onFailed, onPassed))(task),

	/**
	 * Pattern matches on a Task.Validation, returning a Task of the result.
	 *
	 * @see {@link Task.Validation.fold} for positional argument pattern matching.
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
		<E, A, B>(cases: { passed: (value: A) => B; failed: (errors: NonEmptyArr<E>) => B; }) =>
		(task: Task.Validation<E, A>): Task<B> => Task.map(CoreValidation.match<E, A, B>(cases))(task),

	/**
	 * Returns the success value or a default value if the Task.Validation is failed.
	 * The default can be a different type, widening the result to `Task<A | B>`.
	 */
	getOrElse: <B>(fallback: () => B) => <E, A>(task: Task.Validation<E, A>): Task<A | B> =>
		Task.map(CoreValidation.getOrElse<B>(fallback))(task),

	/**
	 * Executes a side effect on the success value without changing the Task.Validation.
	 * Useful for logging or debugging.
	 *
	 * @see {@link Task.Validation.tapError} to perform a side effect on accumulated errors.
	 */
	tap: <E, A>(sideEffect: (value: A) => void) => (task: Task.Validation<E, A>): Task.Validation<E, A> =>
		Task.map(CoreValidation.tap<E, A>(sideEffect))(task),

	/**
	 * Recovers from a Failed state by providing a fallback Task.Validation.
	 * The fallback receives the accumulated error list so callers can inspect which errors occurred.
	 * The fallback can produce a different success type or resolve with a different error type.
	 *
	 * @see {@link Task.Validation.recoverUnless} to conditionally recover based on accumulated errors.
	 */
	recover:
		<E1, E2, B>(fallback: (errors: NonEmptyArr<E1>) => Task.Validation<E2, B>) =>
		<A>(task: Task.Validation<E1, A>): Task.Validation<E2, A | B> =>
			Task.chain((validation: Validation<E1, A>) =>
				CoreValidation.is.passed(validation) ? Task.make(validation as Validation<E2, A | B>) : fallback(validation.errors)
			)(task as Task<Validation<E1, A>>),

	/**
	 * Recovers from a Failed state unless the predicate `isBlocked` returns true for the accumulated errors.
	 * The fallback receives the accumulated errors and can produce a different success type, widening the result to `Task.Validation<E1 | E2, A | B>`.
	 *
	 * @see {@link Task.Validation.recover} for unconditional error recovery.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   validationTask,
	 *   Task.Validation.recoverUnless(
	 *     (errors) => errors.includes("fatal"),
	 *     (errors) => Task.Validation.make.passed("fallback")
	 *   )
	 * );
	 * ```
	 */
	recoverUnless:
		<E1, E2, B>(
			isBlocked: (errors: NonEmptyArr<E1>) => boolean,
			fallback: (errors: NonEmptyArr<E1>) => Task.Validation<E2, B>,
		) =>
		<A>(task: Task.Validation<E1, A>): Task.Validation<E1 | E2, A | B> =>
			Task.chain((validation: Validation<E1, A>) =>
				CoreValidation.is.passed(validation)
					? Task.make(validation as Validation<E1 | E2, A | B>)
					: isBlocked(validation.errors)
					? Task.make(validation as unknown as Validation<E1 | E2, A | B>)
					: fallback(validation.errors)
			)(task as Task<Validation<E1, A>>),

	/**
	 * Runs two Task.Validations concurrently and combines their results into a tuple.
	 * If both are Passed, returns Passed with both values. If either fails, accumulates
	 * errors from both sides.
	 *
	 * @see {@link Task.Validation.productAll} to combine a list of validations.
	 * @see {@link Task.Validation.apply} to apply a curried function across validations.
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
		<E, A, B>(first: Task.Validation<E, A>, second: Task.Validation<E, B>): Task.Validation<E, readonly [A, B]> =>
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
	 * @see {@link Task.Validation.product} to combine two validations into a pair.
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
	productAll: <E, A>(validations: NonEmptyArr<Task.Validation<E, A>>): Task.Validation<E, readonly A[]> => (signal) =>
		Deferred.from.Promise(
			Promise.all(validations.map((t) => Deferred.to.Promise(t(signal)))).then((results) => {
				const [first, ...rest] = results;
				return CoreValidation.productAll([first!, ...rest]);
			}),
		),

	/**
	 * Transforms all accumulated errors inside a Task.Validation.
	 *
	 * @see {@link Task.Validation.map} to transform the success value.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Validation.make.failed("oops"),
	 *   Task.Validation.mapError(e => e.toUpperCase())
	 * ); // Task.Validation(Failed(["OOPS"]))
	 * ```
	 */
	mapError: <E, F, A>(transform: (error: E) => F) => (task: Task.Validation<E, A>): Task.Validation<F, A> =>
		Task.map(CoreValidation.mapError<E, F, A>(transform))(task),

	/**
	 * Executes a side effect on the accumulated errors without changing the Task.Validation.
	 *
	 * @see {@link Task.Validation.tap} to perform a side effect on the success value.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Task.Validation.make.failed("invalid name"),
	 *   Task.Validation.tapError(errs => logger.error(errs))
	 * );
	 * ```
	 */
	tapError:
		<E, A>(sideEffect: (errors: NonEmptyArr<E>) => void) => (task: Task.Validation<E, A>): Task.Validation<E, A> =>
			Task.map(CoreValidation.tapError<E, A>(sideEffect))(task),

	/**
	 * Combines a record of Task.Validations into a single Task.Validation of a record.
	 * Evaluates fields in parallel and accumulates all validation errors.
	 *
	 * @example
	 * ```ts
	 * Task.Validation.struct({
	 *   name: Task.Validation.make.passed("Alice"),
	 *   age: Task.Validation.make.passed(30)
	 * }); // Task.Validation({ name: "Alice", age: 30 })
	 * ```
	 */
	struct:
		<E, R extends Record<string, any>>(fields: { [K in keyof R]: Task.Validation<E, R[K]>; }): Task.Validation<E, R> =>
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
	memoize: <E, A>(task: Task.Validation<E, A>): Task.Validation<E, A> => Task.memoize(task),
};
