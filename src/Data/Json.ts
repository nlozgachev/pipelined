import { Result } from "../Core/Result.ts";

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
 * import { Json, pipe } from "@pplnd/core";
 *
 * const result = pipe(
 *   Json.parse<{ readonly name: string }>('{"name":"Alice"}'),
 *   Result.map((data) => data.name)
 * ); // Ok("Alice")
 * ```
 */
export const Json = {
	/**
	 * Safely parses a JSON string into `unknown` (or a designated type `T`).
	 * Converts thrown exceptions into a `Result<SyntaxError, T>`.
	 *
	 * @example
	 * ```ts
	 * Json.parse('{"a": 1}'); // Ok({ a: 1 })
	 * Json.parse('{invalid}'); // Err(SyntaxError)
	 * ```
	 */
	parse: <T = unknown>(text: string): Result<SyntaxError, T> =>
		Result.tryCatch(() => JSON.parse(text) as T, {
			onError: (err) => (isSyntaxError(err) ? err : new SyntaxError(String(err))),
		}),

	/**
	 * Safely stringifies a value into a JSON string.
	 * Converts thrown exceptions (e.g. circular references) or un-serializable values (e.g. `undefined`, functions) into a `Result<TypeError, string>`.
	 *
	 * @example
	 * ```ts
	 * Json.stringify({ a: 1 }); // Ok('{"a":1}')
	 * Json.stringify(undefined); // Err(TypeError)
	 * ```
	 */
	stringify: (
		value: unknown,
		replacer?: (this: any, key: string, value: any) => any,
		space?: string | number,
	): Result<TypeError, string> => {
		try {
			const text = JSON.stringify(value, replacer as any, space);
			if (text === undefined) {
				return Result.make.err(new TypeError("Value is not JSON serializable"));
			}
			return Result.make.ok(text);
		} catch (err) {
			return Result.make.err(isTypeError(err) ? err : new TypeError(String(err)));
		}
	},
};
