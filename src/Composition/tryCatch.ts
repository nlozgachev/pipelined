/**
 * Creates a pipeline step that wraps a throwing function in a try/catch, returning a fallback value if an error occurs.
 *
 * @example
 * ```ts
 * const parseJSON = tryCatch(
 *   (text: string) => JSON.parse(text),
 *   (_err, text) => ({ fallback: true, raw: text })
 * );
 *
 * parseJSON('{"a":1}'); // { a: 1 }
 * parseJSON('invalid');  // { fallback: true, raw: "invalid" }
 * ```
 */
export const tryCatch =
	<A, B, C>(transform: (value: A) => B, onError: (error: unknown, value: A) => C) => (value: A): B | C => {
		try {
			return transform(value);
		} catch (error) {
			return onError(error, value);
		}
	};
