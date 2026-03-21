import { isNonEmptyList, NonEmptyList } from "../Types/NonEmptyList.ts";
import { WithErrors, WithKind, WithValue } from "./InternalTypes.ts";

/**
 * Validation represents a value that is either valid with a success value,
 * or invalid with accumulated errors.
 * Unlike Result, Validation can accumulate multiple errors instead of short-circuiting.
 *
 * Use Validation when you need to collect all errors (e.g., form validation).
 * Use Result when you want to fail fast on the first error.
 *
 * @example
 * ```ts
 * const validateName = (name: string): Validation<string, string> =>
 *   name.length > 0 ? Validation.valid(name) : Validation.invalid("Name is required");
 *
 * const validateAge = (age: number): Validation<string, number> =>
 *   age >= 0 ? Validation.valid(age) : Validation.invalid("Age must be positive");
 *
 * // Accumulates all errors using ap
 * pipe(
 *   Validation.valid((name: string) => (age: number) => ({ name, age })),
 *   Validation.ap(validateName("")),
 *   Validation.ap(validateAge(-1))
 * );
 * // Invalid(["Name is required", "Age must be positive"])
 * ```
 */
export type Validation<E, A> = Valid<A> | Invalid<E>;

export type Valid<A> = WithKind<"Valid"> & WithValue<A>;
export type Invalid<E> = WithKind<"Invalid"> & WithErrors<E>;

export namespace Validation {
  /**
   * Wraps a value in a valid Validation.
   *
   * @example
   * ```ts
   * Validation.valid(42); // Valid(42)
   * ```
   */
  export const valid = <E, A>(value: A): Validation<E, A> => ({
    kind: "Valid",
    value,
  });

  /**
   * Creates an invalid Validation from a single error.
   *
   * @example
   * ```ts
   * Validation.invalid("Invalid input");
   * ```
   */
  export const invalid = <E>(error: E): Invalid<E> => ({
    kind: "Invalid",
    errors: [error],
  });

  /**
   * Creates an invalid Validation from multiple errors.
   *
   * @example
   * ```ts
   * Validation.invalidAll(["Invalid input"]);
   * ```
   */
  export const invalidAll = <E>(errors: NonEmptyList<E>): Invalid<E> => ({
    kind: "Invalid",
    errors,
  });

  /**
   * Type guard that checks if a Validation is valid.
   */
  export const isValid = <E, A>(data: Validation<E, A>): data is Valid<A> => data.kind === "Valid";

  /**
   * Type guard that checks if a Validation is invalid.
   */
  export const isInvalid = <E, A>(data: Validation<E, A>): data is Invalid<E> =>
    data.kind === "Invalid";

  /**
   * Transforms the success value inside a Validation.
   *
   * @example
   * ```ts
   * pipe(Validation.valid(5), Validation.map(n => n * 2)); // Valid(10)
   * pipe(Validation.invalid("oops"), Validation.map(n => n * 2)); // Invalid(["oops"])
   * ```
   */
  export const map = <A, B>(f: (a: A) => B) => <E>(data: Validation<E, A>): Validation<E, B> =>
    isValid(data) ? valid(f(data.value)) : data;

  /**
   * Chains Validation computations. If the first is Valid, passes the value to f.
   * If the first is Invalid, propagates the errors.
   *
   * Note: chain short-circuits on first error. Use `ap` to accumulate errors.
   *
   * @example
   * ```ts
   * const validatePositive = (n: number): Validation<string, number> =>
   *   n > 0 ? Validation.valid(n) : Validation.invalid("Must be positive");
   *
   * pipe(Validation.valid(5), Validation.chain(validatePositive)); // Valid(5)
   * pipe(Validation.valid(-1), Validation.chain(validatePositive)); // Invalid(["Must be positive"])
   * ```
   */
  export const chain =
    <E, A, B>(f: (a: A) => Validation<E, B>) => (data: Validation<E, A>): Validation<E, B> =>
      isValid(data) ? f(data.value) : data;

  /**
   * Applies a function wrapped in a Validation to a value wrapped in a Validation.
   * Accumulates errors from both sides.
   *
   * @example
   * ```ts
   * const add = (a: number) => (b: number) => a + b;
   * pipe(
   *   Validation.valid(add),
   *   Validation.ap(Validation.valid(5)),
   *   Validation.ap(Validation.valid(3))
   * ); // Valid(8)
   *
   * pipe(
   *   Validation.valid(add),
   *   Validation.ap(Validation.invalid<string, number>("bad a")),
   *   Validation.ap(Validation.invalid<string, number>("bad b"))
   * ); // Invalid(["bad a", "bad b"])
   * ```
   */
  export const ap =
    <E, A>(arg: Validation<E, A>) => <B>(data: Validation<E, (a: A) => B>): Validation<E, B> => {
      if (isValid(data) && isValid(arg)) return valid(data.value(arg.value));
      const errors = [
        ...(isInvalid(data) ? data.errors : []),
        ...(isInvalid(arg) ? arg.errors : []),
      ];
      return isNonEmptyList(errors) ? invalidAll(errors) : valid(data as never);
    };

  /**
   * Extracts the value from a Validation by providing handlers for both cases.
   *
   * @example
   * ```ts
   * pipe(
   *   Validation.valid(42),
   *   Validation.fold(
   *     errors => `Errors: ${errors.join(", ")}`,
   *     value => `Value: ${value}`
   *   )
   * );
   * ```
   */
  export const fold = <E, A, B>(
    onInvalid: (errors: NonEmptyList<E>) => B,
    onValid: (a: A) => B,
  ) =>
  (data: Validation<E, A>): B => isValid(data) ? onValid(data.value) : onInvalid(data.errors);

  /**
   * Pattern matches on a Validation, returning the result of the matching case.
   *
   * @example
   * ```ts
   * pipe(
   *   validation,
   *   Validation.match({
   *     valid: value => `Got ${value}`,
   *     invalid: errors => `Failed: ${errors.join(", ")}`
   *   })
   * );
   * ```
   */
  export const match = <E, A, B>(cases: {
    valid: (a: A) => B;
    invalid: (errors: NonEmptyList<E>) => B;
  }) =>
  (data: Validation<E, A>): B =>
    isValid(data) ? cases.valid(data.value) : cases.invalid(data.errors);

  /**
   * Returns the success value or a default value if the Validation is invalid.
   * The default can be a different type, widening the result to `A | B`.
   *
   * @example
   * ```ts
   * pipe(Validation.valid(5), Validation.getOrElse(0)); // 5
   * pipe(Validation.invalid("oops"), Validation.getOrElse(0)); // 0
   * pipe(Validation.invalid("oops"), Validation.getOrElse(null)); // null — typed as number | null
   * ```
   */
  export const getOrElse = <E, A, B>(defaultValue: () => B) => (data: Validation<E, A>): A | B =>
    isValid(data) ? data.value : defaultValue();

  /**
   * Executes a side effect on the success value without changing the Validation.
   *
   * @example
   * ```ts
   * pipe(
   *   Validation.valid(5),
   *   Validation.tap(n => console.log("Value:", n)),
   *   Validation.map(n => n * 2)
   * );
   * ```
   */
  export const tap = <E, A>(f: (a: A) => void) => (data: Validation<E, A>): Validation<E, A> => {
    if (isValid(data)) f(data.value);
    return data;
  };

  /**
   * Recovers from an Invalid state by providing a fallback Validation.
   * The fallback can produce a different success type, widening the result to `Validation<E, A | B>`.
   */
  export const recover =
    <E, A, B>(fallback: () => Validation<E, B>) => (data: Validation<E, A>): Validation<E, A | B> =>
      isValid(data) ? data : fallback();

  /**
   * Recovers from an Invalid state unless the errors contain any of the blocked errors.
   * The fallback can produce a different success type, widening the result to `Validation<E, A | B>`.
   */
  export const recoverUnless =
    <E, A, B>(blockedErrors: readonly E[], fallback: () => Validation<E, B>) =>
    (data: Validation<E, A>): Validation<E, A | B> =>
      isInvalid(data) &&
        !data.errors.some((err: E) => blockedErrors.includes(err))
        ? fallback()
        : data;

  /**
   * Combines two Validation instances, accumulating errors from both.
   * If both are Valid, returns the second valid value.
   * If either is Invalid, combines their errors into a single Invalid.
   *
   * @example
   * ```ts
   * Validation.combine(
   *   Validation.invalid("Error 1"),
   *   Validation.invalid("Error 2")
   * ); // Invalid(["Error 1", "Error 2"])
   *
   * Validation.combine(
   *   Validation.valid("a"),
   *   Validation.valid("b")
   * ); // Valid("b")
   * ```
   */
  export const combine = <E, A>(
    first: Validation<E, A>,
    second: Validation<E, A>,
  ): Validation<E, A> => {
    if (isValid(first) && isValid(second)) {
      return second;
    }
    const errors = [
      ...(isInvalid(first) ? first.errors : []),
      ...(isInvalid(second) ? second.errors : []),
    ];
    return isNonEmptyList(errors) ? invalidAll(errors) : second;
  };

  /**
   * Combines multiple Validation instances, accumulating all errors.
   * If all are Valid, returns the last valid value.
   * Returns undefined for an empty array.
   *
   * @example
   * ```ts
   * Validation.combineAll([
   *   validateName(name),
   *   validateEmail(email),
   *   validateAge(age)
   * ]);
   * ```
   */
  export const combineAll = <E, A>(
    data: Validation<E, A>[],
  ): Validation<E, A> | undefined =>
    data.length === 0 ? undefined : data.reduce((acc, v) => combine(acc, v));
}
