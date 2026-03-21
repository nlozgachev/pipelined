import { NonEmptyList } from "../Types/NonEmptyList.ts";
import { Deferred } from "./Deferred.ts";
import { Task } from "./Task.ts";
import { Validation } from "./Validation.ts";

/**
 * A Task that resolves to a Validation — combining async operations with
 * error accumulation. Unlike TaskResult, multiple failures are collected
 * rather than short-circuiting on the first error.
 *
 * @example
 * ```ts
 * const validateName = (name: string): TaskValidation<string, string> =>
 *   name.length > 0
 *     ? TaskValidation.valid(name)
 *     : TaskValidation.invalid("Name is required");
 *
 * // Accumulate errors from multiple async validations using ap
 * pipe(
 *   TaskValidation.valid((name: string) => (age: number) => ({ name, age })),
 *   TaskValidation.ap(validateName("")),
 *   TaskValidation.ap(validateAge(-1))
 * )();
 * // Invalid(["Name is required", "Age must be positive"])
 * ```
 */
export type TaskValidation<E, A> = Task<Validation<E, A>>;

export namespace TaskValidation {
  /**
   * Wraps a value in a valid TaskValidation.
   */
  export const valid = <E, A>(value: A): TaskValidation<E, A> =>
    Task.resolve(Validation.valid(value));

  /**
   * Creates a failed TaskValidation with a single error.
   */
  export const invalid = <E, A>(error: E): TaskValidation<E, A> =>
    Task.resolve(Validation.invalid(error));

  /**
   * Creates an invalid TaskValidation from multiple errors.
   */
  export const invalidAll = <E, A>(
    errors: NonEmptyList<E>,
  ): TaskValidation<E, A> => Task.resolve(Validation.invalidAll(errors));

  /**
   * Lifts a Validation into a TaskValidation.
   */
  export const fromValidation = <E, A>(
    validation: Validation<E, A>,
  ): TaskValidation<E, A> => Task.resolve(validation);

  /**
   * Creates a TaskValidation from a Promise-returning function.
   * Catches any errors and transforms them using the onError function.
   *
   * @example
   * ```ts
   * const fetchUser = (id: string): TaskValidation<string, User> =>
   *   TaskValidation.tryCatch(
   *     () => fetch(`/users/${id}`).then(r => r.json()),
   *     e => `Failed to fetch user: ${e}`
   *   );
   * ```
   */
  export const tryCatch = <E, A>(
    f: () => Promise<A>,
    onError: (e: unknown) => E,
  ): TaskValidation<E, A> =>
    Task.from(() =>
      f()
        .then(Validation.valid<E, A>)
        .catch((e) => Validation.invalid(onError(e)))
    );

  /**
   * Transforms the success value inside a TaskValidation.
   */
  export const map =
    <E, A, B>(f: (a: A) => B) => (data: TaskValidation<E, A>): TaskValidation<E, B> =>
      Task.map(Validation.map<A, B>(f))(data);

  /**
   * Applies a function wrapped in a TaskValidation to a value wrapped in a
   * TaskValidation. Both Tasks run in parallel and errors from both sides
   * are accumulated.
   *
   * @example
   * ```ts
   * pipe(
   *   TaskValidation.valid((name: string) => (age: number) => ({ name, age })),
   *   TaskValidation.ap(validateName(name)),
   *   TaskValidation.ap(validateAge(age))
   * )();
   * ```
   */
  export const ap =
    <E, A>(arg: TaskValidation<E, A>) =>
    <B>(data: TaskValidation<E, (a: A) => B>): TaskValidation<E, B> =>
      Task.from(() =>
        Promise.all([
          Deferred.toPromise(data()),
          Deferred.toPromise(arg()),
        ]).then(([vf, va]) => Validation.ap(va)(vf))
      );

  /**
   * Extracts a value from a TaskValidation by providing handlers for both cases.
   */
  export const fold = <E, A, B>(
    onInvalid: (errors: NonEmptyList<E>) => B,
    onValid: (a: A) => B,
  ) =>
  (data: TaskValidation<E, A>): Task<B> =>
    Task.map(Validation.fold<E, A, B>(onInvalid, onValid))(data);

  /**
   * Pattern matches on a TaskValidation, returning a Task of the result.
   *
   * @example
   * ```ts
   * pipe(
   *   validateForm(input),
   *   TaskValidation.match({
   *     valid: data => save(data),
   *     invalid: errors => showErrors(errors)
   *   })
   * )();
   * ```
   */
  export const match = <E, A, B>(cases: {
    valid: (a: A) => B;
    invalid: (errors: NonEmptyList<E>) => B;
  }) =>
  (data: TaskValidation<E, A>): Task<B> => Task.map(Validation.match<E, A, B>(cases))(data);

  /**
   * Returns the success value or a default value if the TaskValidation is invalid.
   * The default can be a different type, widening the result to `Task<A | B>`.
   */
  export const getOrElse =
    <E, A, B>(defaultValue: () => B) => (data: TaskValidation<E, A>): Task<A | B> =>
      Task.map(Validation.getOrElse<E, A, B>(defaultValue))(data);

  /**
   * Executes a side effect on the success value without changing the TaskValidation.
   * Useful for logging or debugging.
   */
  export const tap =
    <E, A>(f: (a: A) => void) => (data: TaskValidation<E, A>): TaskValidation<E, A> =>
      Task.map(Validation.tap<E, A>(f))(data);

  /**
   * Recovers from an Invalid state by providing a fallback TaskValidation.
   * The fallback receives the accumulated error list so callers can inspect which errors occurred.
   * The fallback can produce a different success type, widening the result to `TaskValidation<E, A | B>`.
   */
  export const recover =
    <E, A, B>(fallback: (errors: NonEmptyList<E>) => TaskValidation<E, B>) =>
    (data: TaskValidation<E, A>): TaskValidation<E, A | B> =>
      Task.chain((validation: Validation<E, A>) =>
        Validation.isValid(validation)
          ? Task.resolve(validation as Validation<E, A | B>)
          : fallback(validation.errors)
      )(data);

  /**
   * Runs two TaskValidations concurrently and combines their results into a tuple.
   * If both are Valid, returns Valid with both values. If either fails, accumulates
   * errors from both sides.
   *
   * @example
   * ```ts
   * await TaskValidation.product(
   *   validateName(form.name),
   *   validateAge(form.age),
   * )(); // Valid(["Alice", 30]) or Invalid([...errors])
   * ```
   */
  export const product = <E, A, B>(
    first: TaskValidation<E, A>,
    second: TaskValidation<E, B>,
  ): TaskValidation<E, readonly [A, B]> =>
    Task.from(() =>
      Promise.all([
        Deferred.toPromise(first()),
        Deferred.toPromise(second()),
      ]).then(([va, vb]) => Validation.product(va, vb))
    );

  /**
   * Runs all TaskValidations concurrently and collects results.
   * If all are Valid, returns Valid with all values as an array.
   * If any fail, returns Invalid with all accumulated errors.
   *
   * @example
   * ```ts
   * await TaskValidation.productAll([
   *   validateName(form.name),
   *   validateEmail(form.email),
   *   validateAge(form.age),
   * ])(); // Valid([name, email, age]) or Invalid([...all errors])
   * ```
   */
  export const productAll = <E, A>(
    data: NonEmptyList<TaskValidation<E, A>>,
  ): TaskValidation<E, readonly A[]> =>
    Task.from(() =>
      Promise.all(data.map((t) => Deferred.toPromise(t())))
        .then((results) =>
          Validation.productAll(results as unknown as NonEmptyList<Validation<E, A>>)
        )
    );
}
