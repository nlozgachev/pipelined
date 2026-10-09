/**
 * Builds an object by applying a record of field-level transformer functions to the input value.
 *
 * @example
 * ```ts
 * pipe(
 *   { name: "Alice", age: 25 },
 *   struct({
 *     name: u => u.name,
 *     isAdult: u => u.age >= 18
 *   })
 * ); // { name: "Alice", isAdult: true }
 * ```
 */
export const struct =
	<A, R extends Record<string, unknown>>(fields: { [K in keyof R]: (value: A) => R[K]; }) => (value: A): R => {
		const result = {} as Record<string, unknown>;
		for (const key of Object.keys(fields)) {
			result[key] = fields[key](value);
		}
		return result as R;
	};
