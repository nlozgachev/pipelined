import { Result } from "#core";

const isSyntaxError = (err: unknown): err is SyntaxError =>
	typeof err === "object" && err !== null && "name" in err && (err as Error).name === "SyntaxError";

const isTypeError = (err: unknown): err is TypeError =>
	typeof err === "object" && err !== null && "name" in err && (err as Error).name === "TypeError";

/**
 * Pure, non-throwing JSON utilities.
 * Wraps runtime JSON parsing and stringifying in typed `Result` containers.
 *
 * @example
 * ```ts
 * import { Json } from "@nlozgachev/pipelined/data";
 * import { pipe } from "@nlozgachev/pipelined/composition";
 *
 * const result = pipe(
 *   Json.parse('{"name":"Alice"}'),
 *   Result.map((data: any) => data.name)
 * ); // Ok("Alice")
 * ```
 */
export namespace Json {
	/**
	 * Safely parses a JSON string into `unknown`.
	 * Converts thrown exceptions into a `Result<SyntaxError, unknown>`.
	 *
	 * @example
	 * ```ts
	 * Json.parse('{"a": 1}'); // Ok({ a: 1 })
	 * Json.parse('{invalid}'); // Err(SyntaxError)
	 * ```
	 */
	export const parse = (text: string): Result<SyntaxError, unknown> =>
		Result.tryCatch(() => JSON.parse(text), {
			onError: (err) => (isSyntaxError(err) ? err : new SyntaxError(String(err))),
		});

	/**
	 * Safely stringifies a value into a JSON string.
	 * Converts thrown exceptions (e.g. circular references) into a `Result<TypeError, string>`.
	 *
	 * @example
	 * ```ts
	 * Json.stringify({ a: 1 }); // Ok('{"a":1}')
	 * ```
	 */
	export const stringify = (
		value: unknown,
		replacer?: (this: any, key: string, value: any) => any,
		space?: string | number,
	): Result<TypeError, string> =>
		Result.tryCatch(() => JSON.stringify(value, replacer, space), {
			onError: (err) => (isTypeError(err) ? err : new TypeError(String(err))),
		});
}
