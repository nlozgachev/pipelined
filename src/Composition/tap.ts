import { inspect as nodeInspect } from "node:util";
import { Duration } from "../Types/Duration";

/**
 * Executes a side effect function and returns the original value unchanged.
 * Useful for logging, debugging, or other side effects within a pipeline.
 *
 * @example
 * ```ts
 * // Debugging a pipeline
 * pipe(
 *   Maybe.some(5),
 *   tap(x => console.log("Before map:", x)),
 *   Maybe.map(n => n * 2),
 *   tap(x => console.log("After map:", x)),
 *   Maybe.getOrElse(0)
 * );
 * // logs: "Before map: { kind: 'Some', value: 5 }"
 * // logs: "After map: { kind: 'Some', value: 10 }"
 * // returns: 10
 *
 * // Collecting intermediate values
 * const values: number[] = [];
 * pipe(
 *   [1, 2, 3],
 *   arr => arr.map(n => n * 2),
 *   tap(arr => values.push(...arr))
 * );
 * ```
 *
 * @see {@link Maybe.tap} for Maybe-specific tap that only runs on Some
 */
export function tap<A>(f: (a: A) => void) {
	return (a: A): A => {
		f(a);
		return a;
	};
}

export namespace tap {
	/**
	 * Configuration options for {@link tap.log}.
	 */
	export type LogOptions<A> = {
		/**
		 * An optional label prefix for the log output (e.g., `[label]: value`).
		 */
		readonly label?: string;
		/**
		 * The logging destination function. Defaults to `console.log`.
		 */
		readonly logger?: (message: string) => void;
		/**
		 * A custom formatter function to convert the piped value to a string.
		 * Defaults to `JSON.stringify` for objects and `String(value)` for primitives.
		 */
		readonly formatter?: (value: A) => string;
	};

	/**
	 * Configuration options for {@link tap.inspect}.
	 */
	export type InspectOptions = {
		/**
		 * An optional label prefix for the inspect output (e.g., `[label]: value`).
		 */
		readonly label?: string;
		/**
		 * The maximum depth to recurse when formatting the object.
		 * Defaults to `null` (infinite depth).
		 */
		readonly depth?: number;
		/**
		 * Whether to colorize the output using ANSI color codes.
		 * Defaults to `true`.
		 */
		readonly colors?: boolean;
	};

	/**
	 * Configuration options for {@link tap.async}.
	 */
	export type AsyncOptions = {
		/**
		 * A callback to handle exceptions thrown by the async side-effect.
		 * Defaults to logging via `console.error`.
		 */
		readonly onError?: (error: unknown) => void;
	};

	/**
	 * Configuration options for {@link tap.time}, enforcing mutual exclusivity
	 * between console logging and custom handlers.
	 */
	export type TimeConfig = { label: string; onFinish?: never; } | {
		onFinish: (duration: Duration) => void;
		label?: never;
	};

	/**
	 * Logs the piped value to the console or a custom logger, returning the value unchanged.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   42,
	 *   tap.log(), // logs: 42
	 *   tap.log({ label: "Count" }) // logs: [Count]: 42
	 * );
	 * ```
	 */
	export const log = <A>(options?: LogOptions<A>) => (a: A): A => {
		const logger = options?.logger ?? console.log;
		const formatter = options?.formatter ?? ((val: A) => {
			try {
				return typeof val === "object" && val !== null ? JSON.stringify(val) : String(val);
			} catch {
				return String(val);
			}
		});
		const formatted = formatter(a);
		if (options?.label !== undefined) {
			logger(`[${options.label}]: ${formatted}`);
		} else {
			logger(formatted);
		}
		return a;
	};

	/**
	 * Performs a deep structured inspect formatting on the piped value, returning it unchanged.
	 * In Node.js environments, this utilizes Node's `node:util` `inspect` utility.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   { user: { name: "Alice", details: { age: 30 } } },
	 *   tap.inspect({ label: "User Object", depth: 2 })
	 * );
	 * ```
	 */
	export const inspect = <A>(options?: InspectOptions) => (a: A): A => {
		const label = options?.label;
		const depth = options?.depth ?? null;
		const colors = options?.colors ?? true;

		let formatted: string;
		if (typeof nodeInspect === "function") {
			formatted = nodeInspect(a, { depth, colors });
		} else {
			try {
				formatted = JSON.stringify(a, null, 2);
			} catch {
				formatted = String(a);
			}
		}

		if (label !== undefined) {
			console.log(`[${label}]: ${formatted}`);
		} else {
			console.log(formatted);
		}
		return a;
	};

	/**
	 * Triggers a fire-and-forget asynchronous side effect in the background,
	 * returning the piped value immediately and synchronously.
	 * Any errors thrown by the async function are caught and forwarded to `onError`.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   user,
	 *   tap.async(async (u) => {
	 *     await saveToDatabase(u);
	 *   }, { onError: (err) => logError(err) })
	 * );
	 * ```
	 */
	export const async = <A>(fn: (a: A) => Promise<unknown>, options?: AsyncOptions) => (a: A): A => {
		const onError = options?.onError ?? console.error;
		fn(a).catch((err) => {
			onError(err);
		});
		return a;
	};

	/**
	 * Runs a function and measures its execution duration, returning the value unchanged.
	 * Supports both synchronous and asynchronous functions. If the timed function returns
	 * a Promise, duration measurement resolves asynchronously upon resolution/rejection.
	 *
	 * @example
	 * ```ts
	 * // Time a synchronous computation
	 * pipe(
	 *   data,
	 *   tap.time(processData, { label: "sync-process" })
	 * );
	 *
	 * // Time an asynchronous fetch with custom metrics callback
	 * pipe(
	 *   data,
	 *   tap.time(fetchData, {
	 *     onFinish: (dur) => metrics.histogram("api.time", Duration.toMilliseconds(dur))
	 *   })
	 * );
	 * ```
	 */
	export const time = <A>(fn: (a: A) => unknown, config: TimeConfig) => (a: A): A => {
		const start = performance.now();
		const triggerFinish = (duration: Duration) => {
			if (config.label !== undefined) {
				console.log(`[${config.label}]: ${Duration.toMilliseconds(duration)}ms`);
			} else if (config.onFinish) {
				config.onFinish(duration);
			}
		};

		try {
			const res = fn(a);
			if (res instanceof Promise) {
				res.then(() => {
					const duration = Duration.milliseconds(performance.now() - start);
					triggerFinish(duration);
				}, () => {
					const duration = Duration.milliseconds(performance.now() - start);
					triggerFinish(duration);
				});
			} else {
				const duration = Duration.milliseconds(performance.now() - start);
				triggerFinish(duration);
			}
		} catch (err) {
			const duration = Duration.milliseconds(performance.now() - start);
			triggerFinish(duration);
			throw err;
		}
		return a;
	};
}
