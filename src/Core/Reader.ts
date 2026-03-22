/**
 * A computation that reads from a shared environment `R` and produces a value `A`.
 * Use Reader to thread a dependency (config, logger, DB pool) through a pipeline
 * without passing it explicitly to every function.
 *
 * @example
 * ```ts
 * type Config = { baseUrl: string; apiKey: string };
 *
 * const buildUrl = (path: string): Reader<Config, string> =>
 *   (config) => `${config.baseUrl}${path}`;
 *
 * const withAuth = (url: string): Reader<Config, string> =>
 *   (config) => `${url}?key=${config.apiKey}`;
 *
 * const fetchEndpoint = (path: string): Reader<Config, string> =>
 *   pipe(
 *     buildUrl(path),
 *     Reader.chain(withAuth)
 *   );
 *
 * // Inject the config once at the edge
 * fetchEndpoint("/users")(appConfig); // "https://api.example.com/users?key=secret"
 * ```
 */
export type Reader<R, A> = (env: R) => A;

export namespace Reader {
	/**
	 * Lifts a pure value into a Reader. The environment is ignored.
	 *
	 * @example
	 * ```ts
	 * const always42: Reader<Config, number> = Reader.resolve(42);
	 * always42(anyConfig); // 42
	 * ```
	 */
	export const resolve = <R, A>(value: A): Reader<R, A> => (_env) => value;

	/**
	 * Returns the full environment as the result.
	 * The fundamental way to access the environment in a pipeline.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Reader.ask<Config>(),
	 *   Reader.map(config => config.baseUrl)
	 * )(appConfig); // "https://api.example.com"
	 * ```
	 */
	export const ask = <R>(): Reader<R, R> => (env) => env;

	/**
	 * Projects a value from the environment using a selector function.
	 * Equivalent to `pipe(Reader.ask(), Reader.map(f))` but more direct.
	 *
	 * @example
	 * ```ts
	 * const getBaseUrl: Reader<Config, string> = Reader.asks(c => c.baseUrl);
	 * getBaseUrl(appConfig); // "https://api.example.com"
	 * ```
	 */
	export const asks = <R, A>(f: (env: R) => A): Reader<R, A> => (env) => f(env);

	/**
	 * Transforms the value produced by a Reader.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   Reader.asks((c: Config) => c.baseUrl),
	 *   Reader.map(url => url.toUpperCase())
	 * )(appConfig); // "HTTPS://API.EXAMPLE.COM"
	 * ```
	 */
	export const map = <R, A, B>(f: (a: A) => B) => (data: Reader<R, A>): Reader<R, B> => (env) => f(data(env));

	/**
	 * Sequences two Readers. Both see the same environment.
	 * The output of the first is passed to `f`, which returns the next Reader.
	 *
	 * @example
	 * ```ts
	 * const buildUrl = (path: string): Reader<Config, string> =>
	 *   Reader.asks(c => `${c.baseUrl}${path}`);
	 *
	 * const addAuth = (url: string): Reader<Config, string> =>
	 *   Reader.asks(c => `${url}?key=${c.apiKey}`);
	 *
	 * pipe(
	 *   buildUrl("/items"),
	 *   Reader.chain(addAuth)
	 * )(appConfig); // "https://api.example.com/items?key=secret"
	 * ```
	 */
	export const chain = <R, A, B>(f: (a: A) => Reader<R, B>) => (data: Reader<R, A>): Reader<R, B> => (env) =>
		f(data(env))(env);

	/**
	 * Applies a function wrapped in a Reader to a value wrapped in a Reader.
	 * Both Readers see the same environment.
	 *
	 * @example
	 * ```ts
	 * const add = (a: number) => (b: number) => a + b;
	 * pipe(
	 *   Reader.resolve<Config, typeof add>(add),
	 *   Reader.ap(Reader.asks(c => c.timeout)),
	 *   Reader.ap(Reader.resolve(5))
	 * )(appConfig);
	 * ```
	 */
	export const ap = <R, A>(arg: Reader<R, A>) => <B>(data: Reader<R, (a: A) => B>): Reader<R, B> => (env) =>
		data(env)(arg(env));

	/**
	 * Executes a side effect on the produced value without changing the Reader.
	 * Useful for logging or debugging inside a pipeline.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   buildUrl("/users"),
	 *   Reader.tap(url => console.log("Requesting:", url)),
	 *   Reader.chain(addAuth)
	 * )(appConfig);
	 * ```
	 */
	export const tap = <R, A>(f: (a: A) => void) => (data: Reader<R, A>): Reader<R, A> => (env) => {
		const a = data(env);
		f(a);
		return a;
	};

	/**
	 * Adapts a Reader to work with a different (typically wider) environment
	 * by transforming the environment before passing it to the Reader.
	 * This lets you compose Readers that expect different environments.
	 *
	 * @example
	 * ```ts
	 * type AppEnv = { db: DbPool; config: Config; logger: Logger };
	 *
	 * // buildUrl only needs Config
	 * const buildUrl: Reader<Config, string> = Reader.asks(c => c.baseUrl);
	 *
	 * // Zoom in from AppEnv to Config
	 * const buildUrlFromApp: Reader<AppEnv, string> =
	 *   pipe(buildUrl, Reader.local((env: AppEnv) => env.config));
	 *
	 * buildUrlFromApp(appEnv); // works with the full AppEnv
	 * ```
	 */
	export const local = <R2, R>(f: (env: R2) => R) => <A>(data: Reader<R, A>): Reader<R2, A> => (env) => data(f(env));

	/**
	 * Runs a Reader by supplying the environment. Use this at the edge of your
	 * program where the environment is available.
	 *
	 * @example
	 * ```ts
	 * pipe(
	 *   buildEndpoint("/users"),
	 *   Reader.run(appConfig)
	 * ); // "https://api.example.com/users?key=secret"
	 * ```
	 */
	export const run = <R>(env: R) => <A>(data: Reader<R, A>): A => data(env);
}
