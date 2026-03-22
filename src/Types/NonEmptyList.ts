/**
 * A list that is guaranteed to have at least one element.
 * Useful for ensuring functions receive non-empty input and for
 * accumulating errors in Validation.
 *
 * @example
 * ```ts
 * const errors: NonEmptyList<string> = ["First error", "Second error"];
 *
 * // TypeScript ensures at least one element:
 * const invalid: NonEmptyList<string> = []; // Error!
 * ```
 */
export type NonEmptyList<A> = readonly [A, ...A[]];

/**
 * Type guard that checks if an array is non-empty.
 *
 * @example
 * ```ts
 * const items: string[] = getItems();
 *
 * if (isNonEmptyList(items)) {
 *   // TypeScript knows items has at least one element
 *   const first = items[0]; // string, not string | undefined
 * }
 * ```
 */
export const isNonEmptyList = <A>(
	list: readonly A[],
): list is NonEmptyList<A> => list.length > 0;
